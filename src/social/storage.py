"""Persist + load social profile snapshots dan reference library per brand.

Storage path:
- data/{brand_id}_social_profile.json — single object (latest snapshot per platform)
- data/{brand_id}_references.json     — list of reference items
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from src.ai.brain import DATA_DIR


def _profile_path(brand_id: str) -> Path:
    return DATA_DIR / f"{brand_id}_social_profile.json"


def _references_path(brand_id: str) -> Path:
    return DATA_DIR / f"{brand_id}_references.json"


# ===== Profile snapshots =====


def load_profile(brand_id: str) -> dict:
    """Return {"snapshots": [...]} or empty default."""
    path = _profile_path(brand_id)
    if not path.exists():
        return {"snapshots": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"snapshots": []}


def save_profile_snapshot(
    brand_id: str,
    platform: str,
    handle: str,
    url: str,
    analysis: dict,
    thumbnail_data_url: str,
    status: str = "ready",
    error: str | None = None,
) -> dict:
    """Upsert snapshot per platform — replace existing entry untuk platform yang sama.

    Returns the snapshot dict written.
    """
    data = load_profile(brand_id)
    snapshots = [s for s in data.get("snapshots", []) if s.get("platform") != platform]
    entry = {
        "platform": platform,
        "handle": handle,
        "url": url,
        "captured_at": datetime.now().isoformat(),
        "status": status,
        "error": error,
        "analysis": analysis,
        "thumbnail": thumbnail_data_url,
    }
    snapshots.append(entry)
    data["snapshots"] = snapshots

    DATA_DIR.mkdir(exist_ok=True)
    with open(_profile_path(brand_id), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return entry


def save_profile_pending(brand_id: str, platform: str, handle: str, url: str) -> dict:
    """Insert/replace snapshot dengan status pending sebelum bg task jalan."""
    return save_profile_snapshot(
        brand_id,
        platform=platform,
        handle=handle,
        url=url,
        analysis={},
        thumbnail_data_url="",
        status="pending",
    )


def save_profile_failed(brand_id: str, platform: str, handle: str, url: str, error: str) -> dict:
    return save_profile_snapshot(
        brand_id,
        platform=platform,
        handle=handle,
        url=url,
        analysis={},
        thumbnail_data_url="",
        status="failed",
        error=error,
    )


def delete_profile_snapshot(brand_id: str, platform: str) -> bool:
    """Remove snapshot untuk platform tertentu. Return True kalau ada yang dihapus."""
    data = load_profile(brand_id)
    before = len(data.get("snapshots", []))
    data["snapshots"] = [s for s in data.get("snapshots", []) if s.get("platform") != platform]
    if len(data["snapshots"]) == before:
        return False
    DATA_DIR.mkdir(exist_ok=True)
    with open(_profile_path(brand_id), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return True


# ===== Reference library =====


def load_references(brand_id: str) -> dict:
    path = _references_path(brand_id)
    if not path.exists():
        return {"references": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"references": []}


def add_reference_pending(brand_id: str, url: str, platform: str, tag: str) -> dict:
    """Create reference entry dengan status pending. Return entry."""
    data = load_references(brand_id)
    entry = {
        "id": uuid.uuid4().hex[:12],
        "url": url,
        "platform": platform,
        "tag": tag,  # "own" | "inspiration" | "competitor"
        "added_at": datetime.now().isoformat(),
        "status": "pending",
        "error": None,
        "analysis": {},
        "thumbnail": "",
    }
    data["references"].insert(0, entry)  # newest first
    DATA_DIR.mkdir(exist_ok=True)
    with open(_references_path(brand_id), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return entry


def update_reference(
    brand_id: str,
    ref_id: str,
    *,
    status: str | None = None,
    error: str | None = None,
    analysis: dict | None = None,
    thumbnail: str | None = None,
) -> dict | None:
    """Patch fields on existing reference. Return updated entry or None."""
    data = load_references(brand_id)
    target = None
    for ref in data["references"]:
        if ref["id"] == ref_id:
            target = ref
            break
    if target is None:
        return None
    if status is not None:
        target["status"] = status
    if error is not None:
        target["error"] = error
    if analysis is not None:
        target["analysis"] = analysis
    if thumbnail is not None:
        target["thumbnail"] = thumbnail
    with open(_references_path(brand_id), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return target


def delete_reference(brand_id: str, ref_id: str) -> bool:
    data = load_references(brand_id)
    before = len(data["references"])
    data["references"] = [r for r in data["references"] if r["id"] != ref_id]
    if len(data["references"]) == before:
        return False
    with open(_references_path(brand_id), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return True


def delete_all_for_brand(brand_id: str) -> None:
    """Cleanup helper saat brand dihapus."""
    _profile_path(brand_id).unlink(missing_ok=True)
    _references_path(brand_id).unlink(missing_ok=True)
