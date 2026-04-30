"""
HELIX — FastAPI Backend
HTTP API wrapper untuk AI brain + data access.
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Literal

from datetime import datetime, timezone
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, HttpUrl

# Make sibling modules importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.ai.brain import (  # noqa: E402
    MODEL,
    SYSTEM_PROMPT,
    build_free_system_prompt,
    client as groq_client,
    load_brand_knowledge,
)
from src.scraper.website_scraper import (  # noqa: E402
    save_result as save_scrape_result,
    scrape_brand_website,
)
from src.ai import studio  # noqa: E402
from src.analyzer import csv_adapter, insights_parser, pillar_classifier  # noqa: E402
from src.social import screenshot as social_screenshot  # noqa: E402
from src.social import service as social_service  # noqa: E402
from src.social import storage as social_storage  # noqa: E402

DATA_DIR = PROJECT_ROOT / "data"
CONFIG_DIR = PROJECT_ROOT / "config" / "brands"

app = FastAPI(
    title="HELIX API",
    description="AI Social Media Management Expert",
    version="0.1.0",
)

# CORS — default sudah cover:
# - dev: localhost / 127.0.0.1 any port
# - prod: any *.vercel.app subdomain (frontend Vercel)
# - prod: any *.hf.space subdomain (kalau frontend juga di HF Spaces)
# Override via env CORS_ORIGIN_REGEX kalau punya custom domain.
_default_regex = (
    r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
    r"|https://.*\.vercel\.app"
    r"|https://.*\.hf\.space"
)
_extra_regex = os.getenv("CORS_ORIGIN_REGEX", "")
_combined_regex = (
    f"{_default_regex}|{_extra_regex}" if _extra_regex else _default_regex
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_combined_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== Models ==========

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    # brand_id None = free mode (no brand context, pakai HELIX expertise saja)
    brand_id: str | None = None
    history: list[ChatMessage] = []
    message: str


class ChatResponse(BaseModel):
    reply: str
    history: list[ChatMessage]


class BrandCreateRequest(BaseModel):
    brand_id: str = Field(..., min_length=2, max_length=40, description="slug unik — lowercase, angka, dash")
    brand_name: str = Field(..., min_length=1, max_length=80)
    website_url: HttpUrl
    tagline: str | None = None
    instagram_handle: str | None = Field(None, max_length=60)
    tiktok_handle: str | None = Field(None, max_length=60)


class BrandCreateResponse(BaseModel):
    brand_id: str
    brand_name: str
    website_url: str
    scrape_status: Literal["pending", "ready", "failed"]
    created_at: str


# ========== Helpers ==========

BRAND_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")


def validate_brand_id(brand_id: str) -> None:
    """Reject bad brand_id (path traversal, weird chars, reserved)."""
    if not BRAND_ID_PATTERN.match(brand_id):
        raise HTTPException(
            status_code=400,
            detail="brand_id harus lowercase alphanumeric dengan dash. Contoh: 'my-brand', 'fotofusi'"
        )
    if brand_id.startswith("_"):
        raise HTTPException(status_code=400, detail="brand_id tidak boleh diawali underscore")


# ========== Cache (simple in-memory) ==========

_knowledge_cache: dict[str, str] = {}


def get_cached_knowledge(brand_id: str) -> str:
    if brand_id not in _knowledge_cache:
        _knowledge_cache[brand_id] = load_brand_knowledge(brand_id)
    return _knowledge_cache[brand_id]


# ========== Endpoints ==========

@app.get("/")
def root():
    return {
        "name": "HELIX API",
        "status": "ok",
        "model": MODEL,
    }


@app.get("/brands")
def list_brands():
    """List all brand configs available."""
    brands = []
    for config_file in CONFIG_DIR.glob("*.config.json"):
        brand_id = config_file.stem.replace(".config", "")
        with open(config_file, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        # Brand legacy yang gak punya scrape_status diperlakukan sebagai "ready"
        # (config bundled di repo pasti udah punya data di data/{id}_website.json)
        brands.append({
            "brand_id": brand_id,
            "brand_name": cfg.get("brand_name"),
            "tagline": cfg.get("tagline"),
            "scrape_status": cfg.get("scrape_status", "ready"),
            "scrape_error": cfg.get("scrape_error"),
        })
    return {"brands": brands}


@app.get("/brands/{brand_id}/config")
def get_brand_config(brand_id: str):
    """Get full brand config."""
    path = CONFIG_DIR / f"{brand_id}.config.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Brand '{brand_id}' not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/brands/{brand_id}/insights")
def get_brand_insights(brand_id: str):
    """Get parsed insights data + aggregates."""
    path = DATA_DIR / f"{brand_id}_insights.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No insights for '{brand_id}'")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# Required CSV columns untuk endpoint upload. content_pillar + posted_time
# optional (default "Uncategorized" / "00:00"). Kolom lain semua wajib.
REQUIRED_INSIGHT_COLUMNS = {
    "post_id",
    "date",
    "type",
    "caption",
    "reach",
    "likes",
    "comments",
}


@app.post("/brands/{brand_id}/insights/upload")
async def upload_brand_insights(
    brand_id: str, file: UploadFile = File(...)
):
    """Upload CSV insights → replace existing data → return parsed aggregates.

    Smart adapter (Sprint 9b): auto-detect format HELIX vs Instagram export
    vs TikTok export. Map source columns ke schema HELIX, lalu LLM tag
    content_pillar untuk row yang gak punya pillar (pakai brand pillars).
    """
    _ensure_brand(brand_id)

    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File harus berekstensi .csv")

    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:  # 5 MB cap, plenty buat ribuan post
        raise HTTPException(status_code=413, detail="CSV maksimal 5 MB")
    try:
        text = raw.decode("utf-8-sig")  # strip BOM kalau ada (export Excel)
    except UnicodeDecodeError:
        try:
            text = raw.decode("latin-1")
        except Exception:
            raise HTTPException(status_code=400, detail="Encoding CSV tidak dikenali (coba save UTF-8)")

    # Step 1: parse + detect format
    src_rows, fieldnames = csv_adapter.parse_csv_text(text)
    if not fieldnames:
        raise HTTPException(status_code=400, detail="CSV kosong atau tidak punya header")
    if not src_rows:
        raise HTTPException(status_code=400, detail="CSV punya header tapi tidak ada data row")

    fmt = csv_adapter.detect_format(fieldnames)
    if fmt == "unknown":
        raise HTTPException(
            status_code=400,
            detail=(
                "Format CSV tidak dikenali. HELIX support: schema HELIX (post_id, "
                "date, type, caption, reach, likes, comments), atau export "
                "Instagram (Permalink/Publish time/Post type), atau export "
                "TikTok (Video views/Date posted). Cek headers atau download "
                "template HELIX."
            ),
        )

    # Step 2: adapt rows ke schema HELIX (no-op kalau format = helix)
    helix_rows, adapt_report = csv_adapter.adapt_rows(src_rows, fmt)

    # Step 3: validate required columns ada di hasil
    if fmt == "helix":
        present = {h.strip() for h in fieldnames}
        missing = REQUIRED_INSIGHT_COLUMNS - present
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Kolom wajib hilang: {sorted(missing)}. Wajib: {sorted(REQUIRED_INSIGHT_COLUMNS)}",
            )
    else:
        # Untuk format adapted, cek bahwa setidaknya date + caption ke-extract
        sample_missing_date = sum(1 for r in helix_rows if not r.get("date"))
        if sample_missing_date == len(helix_rows):
            raise HTTPException(
                status_code=400,
                detail=f"Format {fmt} terdeteksi tapi kolom tanggal tidak ke-parse. Cek format date di export.",
            )

    # Step 4: classify content_pillar untuk row yang kosong
    brand_pillars = _load_brand_pillars(brand_id)
    missing_pillar_rows = [r for r in helix_rows if not (r.get("content_pillar") or "").strip()]
    pillars_classified_count = 0
    if missing_pillar_rows and brand_pillars:
        try:
            pillar_map = pillar_classifier.classify_pillars(missing_pillar_rows, brand_pillars)
            for r in helix_rows:
                if not (r.get("content_pillar") or "").strip():
                    r["content_pillar"] = pillar_map.get(r["post_id"], brand_pillars[0])
            pillars_classified_count = len(missing_pillar_rows)
        except Exception:
            # LLM gagal — fallback ke pillar pertama biar parser tetap jalan
            for r in helix_rows:
                if not (r.get("content_pillar") or "").strip():
                    r["content_pillar"] = brand_pillars[0]
    elif missing_pillar_rows:
        # Brand tidak punya pillars → fallback string
        for r in helix_rows:
            if not (r.get("content_pillar") or "").strip():
                r["content_pillar"] = "Uncategorized"

    # Step 5: serialize ke HELIX schema CSV → tulis ke disk
    final_csv = csv_adapter.rows_to_csv(helix_rows)
    csv_path = DATA_DIR / f"{brand_id}_insights.csv"
    csv_path.write_text(final_csv, encoding="utf-8")

    # Step 6: run insights parser → JSON aggregates
    try:
        result = insights_parser.process_brand_insights(brand_id)
    except Exception as e:
        csv_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"CSV gagal di-parse: {e}")

    # Step 7: tag JSON dengan source + adaptation report
    json_path = DATA_DIR / f"{brand_id}_insights.json"
    result["source"] = "uploaded"
    result["uploaded_at"] = datetime.now(timezone.utc).isoformat()
    result["adaptation"] = {
        **adapt_report,
        "pillars_classified": pillars_classified_count,
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return result


def _update_config(brand_id: str, **updates) -> None:
    """Patch fields in {brand_id}.config.json. Safe no-op if file missing."""
    path = CONFIG_DIR / f"{brand_id}.config.json"
    if not path.exists():
        return
    with open(path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    cfg.update(updates)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def _run_scrape_in_background(brand_id: str, website_url: str) -> None:
    """Background task: scrape website + update config status.

    On success: scrape_status="ready", pages_scraped=N
    On failure: scrape_status="failed", scrape_error=str
    Tidak menghapus config — biar user bisa retry dari UI nanti (atau hapus manual).
    """
    try:
        scrape_result = scrape_brand_website(brand_id, base_url=website_url)
        save_scrape_result(scrape_result, brand_id)
        _update_config(
            brand_id,
            scrape_status="ready",
            pages_scraped=scrape_result["pages_scraped"],
            scrape_error=None,
        )
        # Invalidate knowledge cache supaya chat/studio pakai data baru
        _knowledge_cache.pop(brand_id, None)
    except Exception as e:
        _update_config(
            brand_id,
            scrape_status="failed",
            scrape_error=str(e)[:300],
        )


@app.post("/brands", response_model=BrandCreateResponse, status_code=201)
def create_brand(req: BrandCreateRequest, background_tasks: BackgroundTasks):
    """Create new brand: save config immediately, scrape in background.

    Returns 201 dengan scrape_status="pending". Frontend polling /brands akan
    lihat status berubah ke "ready" atau "failed" setelah scrape kelar.
    """
    validate_brand_id(req.brand_id)

    config_path = CONFIG_DIR / f"{req.brand_id}.config.json"
    if config_path.exists():
        raise HTTPException(
            status_code=409,
            detail=f"Brand '{req.brand_id}' sudah ada"
        )

    from datetime import datetime
    created_at = datetime.now().isoformat()
    website_url = str(req.website_url).rstrip("/")

    config = {
        "brand_id": req.brand_id,
        "brand_name": req.brand_name,
        "website_url": website_url,
        "created_at": created_at,
        "scrape_status": "pending",
    }
    if req.tagline:
        config["tagline"] = req.tagline
    if req.instagram_handle:
        config["instagram_handle"] = social_screenshot.normalize_handle(req.instagram_handle)
    if req.tiktok_handle:
        config["tiktok_handle"] = social_screenshot.normalize_handle(req.tiktok_handle)

    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    # Schedule website scrape — runs after response sent.
    background_tasks.add_task(_run_scrape_in_background, req.brand_id, website_url)

    # Auto-trigger social profile snapshot kalau handle disediakan
    if req.instagram_handle:
        ig_handle = social_screenshot.normalize_handle(req.instagram_handle)
        social_storage.save_profile_pending(
            req.brand_id, "instagram", ig_handle,
            social_screenshot.profile_url("instagram", ig_handle),
        )
        background_tasks.add_task(
            social_service.snapshot_profile, req.brand_id, "instagram", ig_handle
        )
    if req.tiktok_handle:
        tt_handle = social_screenshot.normalize_handle(req.tiktok_handle)
        social_storage.save_profile_pending(
            req.brand_id, "tiktok", tt_handle,
            social_screenshot.profile_url("tiktok", tt_handle),
        )
        background_tasks.add_task(
            social_service.snapshot_profile, req.brand_id, "tiktok", tt_handle
        )

    return BrandCreateResponse(
        brand_id=req.brand_id,
        brand_name=req.brand_name,
        website_url=website_url,
        scrape_status="pending",
        created_at=created_at,
    )


@app.delete("/brands/{brand_id}", status_code=204)
def delete_brand(brand_id: str):
    """Delete a brand: remove config + scraped data + insights data."""
    validate_brand_id(brand_id)

    # Safety: never delete fotofusi (demo brand) via API
    if brand_id == "fotofusi":
        raise HTTPException(
            status_code=403,
            detail="Demo brand 'fotofusi' tidak bisa dihapus via API"
        )

    config_path = CONFIG_DIR / f"{brand_id}.config.json"
    if not config_path.exists():
        raise HTTPException(status_code=404, detail=f"Brand '{brand_id}' not found")

    # Remove all associated files
    config_path.unlink(missing_ok=True)
    (DATA_DIR / f"{brand_id}_website.json").unlink(missing_ok=True)
    (DATA_DIR / f"{brand_id}_insights.json").unlink(missing_ok=True)
    (DATA_DIR / f"{brand_id}_insights.csv").unlink(missing_ok=True)
    social_storage.delete_all_for_brand(brand_id)

    # Invalidate cache
    _knowledge_cache.pop(brand_id, None)

    return None


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """Send a message to HELIX AI brain. Stateless — client sends full history.

    Mode:
    - brand_id provided → brand-aware chat (load brand knowledge + brand-specific prompt)
    - brand_id None     → free mode (no brand context, HELIX expertise saja)
    """
    if req.brand_id:
        # Brand mode: verify brand exists
        config_path = CONFIG_DIR / f"{req.brand_id}.config.json"
        if not config_path.exists():
            raise HTTPException(status_code=404, detail=f"Brand '{req.brand_id}' not found")
        knowledge = get_cached_knowledge(req.brand_id)
        system_content = f"{SYSTEM_PROMPT}\n\n=== DATA BRAND ===\n{knowledge}"
    else:
        # Free mode: HELIX expertise saja, no brand context
        system_content = build_free_system_prompt()

    # Build message list for Groq
    messages = [{"role": "system", "content": system_content}]
    for msg in req.history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": req.message})

    try:
        response = groq_client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")

    # Build updated history (exclude system)
    updated_history = list(req.history)
    updated_history.append(ChatMessage(role="user", content=req.message))
    updated_history.append(ChatMessage(role="assistant", content=reply))

    return ChatResponse(reply=reply, history=updated_history)


def _build_chat_messages(req: ChatRequest) -> list[dict]:
    """Build OpenAI/Groq message list dari ChatRequest. Validate brand kalau brand_id ada."""
    if req.brand_id:
        config_path = CONFIG_DIR / f"{req.brand_id}.config.json"
        if not config_path.exists():
            raise HTTPException(status_code=404, detail=f"Brand '{req.brand_id}' not found")
        knowledge = get_cached_knowledge(req.brand_id)
        system_content = f"{SYSTEM_PROMPT}\n\n=== DATA BRAND ===\n{knowledge}"
    else:
        system_content = build_free_system_prompt()

    messages = [{"role": "system", "content": system_content}]
    for msg in req.history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": req.message})
    return messages


@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    """Streaming version of /chat — SSE format, lebih cepat first-byte.

    Frontend consume via ReadableStream. Event format:
        data: {"type": "chunk", "text": "..."}\\n\\n
        data: {"type": "done"}\\n\\n
        data: {"type": "error", "message": "..."}\\n\\n  (kalau gagal mid-stream)
    """
    # Validation di luar generator biar HTTPException ke-raise sebelum response start
    messages = _build_chat_messages(req)

    def event_stream():
        try:
            stream = groq_client.chat.completions.create(
                model=MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=2048,
                stream=True,
            )
            for chunk in stream:
                delta = ""
                try:
                    delta = chunk.choices[0].delta.content or ""
                except (IndexError, AttributeError):
                    delta = ""
                if delta:
                    payload = json.dumps({"type": "chunk", "text": delta}, ensure_ascii=False)
                    yield f"data: {payload}\n\n"
            yield 'data: {"type":"done"}\n\n'
        except Exception as e:
            err_payload = json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Disable proxy buffering — HF Spaces (nginx-style) bisa hold chunk
            # sampai response selesai kalau gak di-disable. Frontend baru terima
            # data setelah Groq selesai, defeating tujuan streaming.
            "X-Accel-Buffering": "no",
        },
    )


# ========== Content Studio endpoints ==========

class HookRequest(BaseModel):
    # brand_id None = free mode (HELIX expertise saja, no brand DNA)
    brand_id: str | None = None
    topic: str = Field(..., min_length=3, max_length=500)
    format_type: Literal["reel", "tiktok", "story"] = "reel"
    count: int = Field(5, ge=3, le=10)


class CaptionRequest(BaseModel):
    brand_id: str | None = None
    post_context: str = Field(..., min_length=5, max_length=1000)
    goal: Literal["awareness", "engagement", "sales", "education"] = "engagement"
    length: Literal["short", "medium", "long"] = "medium"


class CarouselRequest(BaseModel):
    brand_id: str | None = None
    topic: str = Field(..., min_length=3, max_length=500)
    num_slides: int = Field(5, ge=3, le=10)
    goal: Literal["education", "storytelling", "listicle", "promotion"] = "education"


class PlanRequest(BaseModel):
    brand_id: str | None = None
    period: Literal["week", "month"] = "week"
    posts_per_week: int = Field(4, ge=2, le=7)
    start_date: str | None = None  # YYYY-MM-DD; default today
    goals: list[Literal["awareness", "engagement", "sales", "education"]] | None = None
    theme: str | None = Field(None, max_length=500)  # tema konten user — bias hook & angle


class BriefRequest(BaseModel):
    brand_id: str | None = None
    format_type: Literal["reel", "carousel_foto", "single_foto", "story"]
    topic: str = Field(..., min_length=3, max_length=500)
    mode: Literal["tiru", "modifikasi", "original"] = "original"
    angle: str | None = Field(None, max_length=500)
    reference_ids: list[str] | None = None
    reference_text: str | None = Field(None, max_length=2000)
    pillar: str | None = Field(None, max_length=100)
    goal: Literal["awareness", "engagement", "sales", "education"] | None = None
    # 2-step workflow: kalau user udah pilih judul di step 1, lock ke judul itu
    chosen_title: str | None = Field(None, max_length=200)
    # REEL only: paksa exactly N scenes (3-10). None = LLM bebas (default 5-8)
    scene_count: int | None = Field(None, ge=3, le=10)


class BriefTitlesRequest(BaseModel):
    brand_id: str | None = None
    format_type: Literal["reel", "carousel_foto", "single_foto", "story"]
    topic: str = Field(..., min_length=3, max_length=500)
    mode: Literal["tiru", "modifikasi", "original"] = "original"
    angle: str | None = Field(None, max_length=500)
    reference_ids: list[str] | None = None
    reference_text: str | None = Field(None, max_length=2000)
    pillar: str | None = Field(None, max_length=100)
    goal: Literal["awareness", "engagement", "sales", "education"] | None = None
    count: int = Field(5, ge=3, le=7)


class BriefSceneRegenRequest(BaseModel):
    brand_id: str | None = None
    title: str = Field(..., min_length=2, max_length=200)
    topic: str = Field(..., min_length=3, max_length=500)
    scenes_so_far: list[dict] = Field(..., min_length=1)
    scene_no: int = Field(..., ge=1, le=20)
    hint: str | None = Field(None, max_length=300)
    angle: str | None = Field(None, max_length=500)
    pillar: str | None = Field(None, max_length=100)
    goal: Literal["awareness", "engagement", "sales", "education"] | None = None


def _ensure_brand(brand_id: str):
    if not (CONFIG_DIR / f"{brand_id}.config.json").exists():
        raise HTTPException(status_code=404, detail=f"Brand '{brand_id}' not found")


def _load_brand_pillars(brand_id: str) -> list[str]:
    """Read content_strategy.content_pillars dari brand config. Empty kalau gak ada."""
    path = CONFIG_DIR / f"{brand_id}.config.json"
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except Exception:
        return []
    pillars = cfg.get("content_strategy", {}).get("content_pillars", [])
    if not isinstance(pillars, list):
        return []
    return [str(p).strip() for p in pillars if str(p).strip()]


@app.post("/studio/hook")
def studio_hook(req: HookRequest):
    if req.brand_id:
        _ensure_brand(req.brand_id)
    try:
        return studio.generate_hooks(
            req.brand_id, req.topic, req.format_type, req.count
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")


@app.post("/studio/caption")
def studio_caption(req: CaptionRequest):
    if req.brand_id:
        _ensure_brand(req.brand_id)
    try:
        return studio.generate_caption(
            req.brand_id, req.post_context, req.goal, req.length
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")


@app.post("/studio/carousel")
def studio_carousel(req: CarouselRequest):
    if req.brand_id:
        _ensure_brand(req.brand_id)
    try:
        return studio.generate_carousel(
            req.brand_id, req.topic, req.num_slides, req.goal
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")


@app.get("/expertise")
def list_expertise():
    """List active expertise knowledge sources used by Studio prompts."""
    _, manifest = studio.load_expertise()
    return {"expertise": manifest}


# ========== Social profile + reference library endpoints ==========


class ProfileSnapshotRequest(BaseModel):
    platform: Literal["instagram", "tiktok"]
    handle: str = Field(..., min_length=1, max_length=60)


class ReferenceCreateRequest(BaseModel):
    url: str = Field(..., min_length=10, max_length=500)
    tag: Literal["own", "inspiration", "competitor"] = "inspiration"


@app.post("/brands/{brand_id}/social/snapshot", status_code=202)
def trigger_profile_snapshot(
    brand_id: str,
    req: ProfileSnapshotRequest,
    background_tasks: BackgroundTasks,
):
    """Schedule profile snapshot — return langsung dengan status pending."""
    _ensure_brand(brand_id)
    handle = social_screenshot.normalize_handle(req.handle)
    url = social_screenshot.profile_url(req.platform, handle)
    entry = social_storage.save_profile_pending(brand_id, req.platform, handle, url)
    background_tasks.add_task(
        social_service.snapshot_profile, brand_id, req.platform, handle
    )
    return entry


@app.get("/brands/{brand_id}/social/profile")
def get_profile_snapshots(brand_id: str):
    """Return all snapshot per platform untuk brand ini."""
    _ensure_brand(brand_id)
    return social_storage.load_profile(brand_id)


@app.delete("/brands/{brand_id}/social/profile/{platform}", status_code=204)
def remove_profile_snapshot(brand_id: str, platform: str):
    _ensure_brand(brand_id)
    if platform not in ("instagram", "tiktok"):
        raise HTTPException(status_code=400, detail="platform harus 'instagram' atau 'tiktok'")
    if not social_storage.delete_profile_snapshot(brand_id, platform):
        raise HTTPException(status_code=404, detail=f"Profile snapshot {platform} tidak ada")
    return None


@app.post("/brands/{brand_id}/references", status_code=202)
def add_reference(
    brand_id: str,
    req: ReferenceCreateRequest,
    background_tasks: BackgroundTasks,
):
    """Tambah URL reference — screenshot + analyze di background."""
    _ensure_brand(brand_id)
    if not social_screenshot.is_supported_url(req.url):
        raise HTTPException(
            status_code=400,
            detail="URL hanya support Instagram (instagram.com) atau TikTok (tiktok.com)",
        )
    platform = social_screenshot.detect_platform(req.url)
    entry = social_storage.add_reference_pending(brand_id, req.url, platform, req.tag)
    background_tasks.add_task(
        social_service.analyze_reference_url, brand_id, entry["id"], req.url
    )
    return entry


@app.get("/brands/{brand_id}/references")
def list_references(brand_id: str):
    """List all references untuk brand ini."""
    _ensure_brand(brand_id)
    return social_storage.load_references(brand_id)


@app.delete("/brands/{brand_id}/references/{ref_id}", status_code=204)
def remove_reference(brand_id: str, ref_id: str):
    _ensure_brand(brand_id)
    if not social_storage.delete_reference(brand_id, ref_id):
        raise HTTPException(status_code=404, detail=f"Reference '{ref_id}' not found")
    return None


@app.post("/studio/plan")
def studio_plan(req: PlanRequest):
    if req.brand_id:
        _ensure_brand(req.brand_id)
    try:
        return studio.generate_plan(
            req.brand_id,
            period=req.period,
            posts_per_week=req.posts_per_week,
            start_date=req.start_date,
            goals=req.goals,
            theme=req.theme,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")


@app.post("/studio/brief/titles")
def studio_brief_titles(req: BriefTitlesRequest):
    """Step 1 of 2-step Brief workflow — return N rekomendasi judul."""
    if req.brand_id:
        _ensure_brand(req.brand_id)
    try:
        return studio.generate_titles(
            req.brand_id,
            format_type=req.format_type,
            topic=req.topic,
            mode=req.mode,
            angle=req.angle,
            reference_ids=req.reference_ids,
            reference_text=req.reference_text,
            pillar=req.pillar,
            goal=req.goal,
            count=req.count,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")


@app.post("/studio/brief/scene/regen")
def studio_brief_scene_regen(req: BriefSceneRegenRequest):
    """Regen 1 scene specific dari brief reel yang udah ada (per-scene fine-tune)."""
    if req.brand_id:
        _ensure_brand(req.brand_id)
    try:
        return studio.regen_one_scene(
            req.brand_id,
            title=req.title,
            topic=req.topic,
            scenes_so_far=req.scenes_so_far,
            scene_no=req.scene_no,
            hint=req.hint,
            angle=req.angle,
            pillar=req.pillar,
            goal=req.goal,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")


@app.post("/studio/brief")
def studio_brief(req: BriefRequest):
    if req.brand_id:
        _ensure_brand(req.brand_id)
    try:
        return studio.generate_brief(
            req.brand_id,
            format_type=req.format_type,
            topic=req.topic,
            mode=req.mode,
            angle=req.angle,
            reference_ids=req.reference_ids,
            reference_text=req.reference_text,
            pillar=req.pillar,
            goal=req.goal,
            chosen_title=req.chosen_title,
            scene_count=req.scene_count,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
