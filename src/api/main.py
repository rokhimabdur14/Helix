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

from fastapi import FastAPI, HTTPException
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

DATA_DIR = PROJECT_ROOT / "data"
CONFIG_DIR = PROJECT_ROOT / "config" / "brands"

app = FastAPI(
    title="HELIX API",
    description="AI Social Media Management Expert",
    version="0.1.0",
)

# CORS — dev: localhost any port. Prod: tambahkan domain Vercel via env var
# CORS_ORIGIN_REGEX (mis. "https://my-app.*\.vercel\.app|https://my-domain\.com")
_default_dev_regex = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
_prod_regex = os.getenv("CORS_ORIGIN_REGEX", "")
_combined_regex = (
    f"{_default_dev_regex}|{_prod_regex}" if _prod_regex else _default_dev_regex
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


class BrandCreateResponse(BaseModel):
    brand_id: str
    brand_name: str
    website_url: str
    pages_scraped: int
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
        brands.append({
            "brand_id": brand_id,
            "brand_name": cfg.get("brand_name"),
            "tagline": cfg.get("tagline"),
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


@app.post("/brands", response_model=BrandCreateResponse, status_code=201)
def create_brand(req: BrandCreateRequest):
    """Create new brand: save minimal config, auto-scrape website."""
    validate_brand_id(req.brand_id)

    config_path = CONFIG_DIR / f"{req.brand_id}.config.json"
    if config_path.exists():
        raise HTTPException(
            status_code=409,
            detail=f"Brand '{req.brand_id}' sudah ada"
        )

    # 1. Write minimal starter config
    from datetime import datetime
    created_at = datetime.now().isoformat()

    config = {
        "brand_id": req.brand_id,
        "brand_name": req.brand_name,
        "website_url": str(req.website_url).rstrip("/"),
        "created_at": created_at,
    }
    if req.tagline:
        config["tagline"] = req.tagline

    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    # 2. Scrape website (synchronous for now — OK for MVP)
    try:
        scrape_result = scrape_brand_website(
            req.brand_id,
            base_url=str(req.website_url)
        )
        save_scrape_result(scrape_result, req.brand_id)
        pages_scraped = scrape_result["pages_scraped"]
    except Exception as e:
        # Rollback config if scrape fails completely
        config_path.unlink(missing_ok=True)
        raise HTTPException(status_code=502, detail=f"Scrape failed: {e}")

    # 3. Invalidate knowledge cache
    _knowledge_cache.pop(req.brand_id, None)

    return BrandCreateResponse(
        brand_id=req.brand_id,
        brand_name=req.brand_name,
        website_url=str(req.website_url),
        pages_scraped=pages_scraped,
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
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
