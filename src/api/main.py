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

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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


# ========== Content Studio endpoints ==========

class HookRequest(BaseModel):
    brand_id: str
    topic: str = Field(..., min_length=3, max_length=500)
    format_type: Literal["reel", "tiktok", "story"] = "reel"
    count: int = Field(5, ge=3, le=10)


class CaptionRequest(BaseModel):
    brand_id: str
    post_context: str = Field(..., min_length=5, max_length=1000)
    goal: Literal["awareness", "engagement", "sales", "education"] = "engagement"
    length: Literal["short", "medium", "long"] = "medium"


class CarouselRequest(BaseModel):
    brand_id: str
    topic: str = Field(..., min_length=3, max_length=500)
    num_slides: int = Field(5, ge=3, le=10)
    goal: Literal["education", "storytelling", "listicle", "promotion"] = "education"


class PlanRequest(BaseModel):
    brand_id: str
    period: Literal["week", "month"] = "week"
    posts_per_week: int = Field(4, ge=2, le=7)
    start_date: str | None = None  # YYYY-MM-DD; default today
    goals: list[Literal["awareness", "engagement", "sales", "education"]] | None = None
    theme: str | None = Field(None, max_length=500)  # tema konten user — bias hook & angle


def _ensure_brand(brand_id: str):
    if not (CONFIG_DIR / f"{brand_id}.config.json").exists():
        raise HTTPException(status_code=404, detail=f"Brand '{brand_id}' not found")


@app.post("/studio/hook")
def studio_hook(req: HookRequest):
    _ensure_brand(req.brand_id)
    try:
        return studio.generate_hooks(
            req.brand_id, req.topic, req.format_type, req.count
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")


@app.post("/studio/caption")
def studio_caption(req: CaptionRequest):
    _ensure_brand(req.brand_id)
    try:
        return studio.generate_caption(
            req.brand_id, req.post_context, req.goal, req.length
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")


@app.post("/studio/carousel")
def studio_carousel(req: CarouselRequest):
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
