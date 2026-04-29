"""
HELIX — Pillar Classifier
Auto-tag content_pillar pakai LLM untuk post-post yang belum di-classify
(biasanya raw export IG/TT yang gak punya kolom pillar).

Input: posts (HELIX schema row) + brand pillars list.
Output: dict {post_id: pillar_name}.
"""

import json
from typing import Iterable

from src.ai.brain import client

# 8b instant cukup untuk classification — fast + hemat quota
CLASSIFIER_MODEL = "llama-3.1-8b-instant"

# Caption length cap per post — biar prompt tidak meledak. 200 char cukup
# untuk dapat sinyal pillar (intro + 1-2 kalimat).
CAPTION_PREVIEW_LEN = 220

# Batch size — 25-30 post per call aman untuk TPM 8b (6000 TPM)
BATCH_SIZE = 25


def classify_pillars(
    posts: list[dict],
    pillars: list[str],
) -> dict[str, str]:
    """Classify content_pillar per post berdasarkan caption + brand pillars.

    Posts tanpa caption → fallback ke pillars[0].
    LLM call gagal → fallback semua di batch ke pillars[0].

    Returns:
        dict {post_id: pillar_name}. Pillar dijamin berasal dari list `pillars`.
    """
    if not posts:
        return {}
    fallback = pillars[0] if pillars else "Uncategorized"
    if not pillars:
        return {p["post_id"]: fallback for p in posts}

    out: dict[str, str] = {}
    targets = []
    for p in posts:
        if (p.get("caption") or "").strip():
            targets.append(p)
        else:
            out[p["post_id"]] = fallback

    valid_pillars = set(pillars)
    for i in range(0, len(targets), BATCH_SIZE):
        chunk = targets[i:i + BATCH_SIZE]
        try:
            classifications = _classify_batch(chunk, pillars)
        except Exception:
            classifications = {}
        for p in chunk:
            tag = classifications.get(p["post_id"], "")
            out[p["post_id"]] = tag if tag in valid_pillars else fallback

    # Safety net: post id yang miss
    for p in posts:
        out.setdefault(p["post_id"], fallback)
    return out


def _classify_batch(posts: list[dict], pillars: list[str]) -> dict[str, str]:
    pillars_listing = "\n".join(f"- {p}" for p in pillars)
    items_text = "\n".join(
        f"[{p['post_id']}] {(p.get('caption') or '')[:CAPTION_PREVIEW_LEN]}"
        for p in posts
    )

    system = (
        "Kamu adalah HELIX content classifier. Tugas: untuk SETIAP post di list, "
        "tentukan content pillar yang PALING SESUAI dari daftar pillar yang "
        "diberikan. Output WAJIB JSON valid. Field 'pillar' HARUS persis sama "
        "(case-sensitive, full string) dengan salah satu pillar di daftar. "
        "Jangan singkat, jangan ubah, jangan tambah pillar baru."
    )
    user = f"""DAFTAR PILLAR (pilih satu untuk setiap post):
{pillars_listing}

POSTS YANG HARUS DI-CLASSIFY:
{items_text}

Output schema:
{{"classifications": [{{"post_id": "<id>", "pillar": "<pillar persis dari daftar>"}}]}}

Wajib output entry untuk SEMUA post_id di atas."""

    response = client.chat.completions.create(
        model=CLASSIFIER_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.1,
        max_tokens=2048,
        response_format={"type": "json_object"},
    )
    data = json.loads(response.choices[0].message.content)
    out: dict[str, str] = {}
    for entry in data.get("classifications", []):
        pid = entry.get("post_id")
        pillar = entry.get("pillar")
        if pid and pillar:
            out[str(pid)] = str(pillar)
    return out
