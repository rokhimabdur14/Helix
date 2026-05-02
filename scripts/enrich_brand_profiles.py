"""Enrich minimal brand configs dengan tagline + brand_voice + content_pillars +
target_personas, di-derive dari scraped website pakai 70b LLM.

Usage:
    python scripts/enrich_brand_profiles.py [brand_id ...]
    python scripts/enrich_brand_profiles.py --all   # all brands w/ minimal config

Brand dianggap "minimal" kalau config-nya cuma punya brand_id/brand_name/website_url/
created_at (no tagline/brand_voice/content_strategy). Brand yang udah enriched
(misal fotofusi) di-skip kecuali di-pass eksplisit.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Pastikan import dari src/ jalan saat run dari root
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]

from src.ai.studio import PLAN_MODEL, _generate_json  # noqa: E402

CONFIG_DIR = ROOT / "config" / "brands"
DATA_DIR = ROOT / "data"


def extract_website_text(brand_id: str, max_chars: int = 8000) -> str | None:
    path = DATA_DIR / f"{brand_id}_website.json"
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as f:
        d = json.load(f)
    parts = [f"BRAND: {d['brand_name']}", f"URL: {d['base_url']}"]
    for p in d.get("pages", []):
        parts.append(f"\n=== {p.get('url', '')}")
        if p.get("title"):
            parts.append(f"TITLE: {p['title']}")
        if p.get("meta_description"):
            parts.append(f"META: {p['meta_description']}")
        for b in p.get("blocks", []):
            if not isinstance(b, dict):
                continue
            t = b.get("type")
            if t == "section":
                if b.get("heading"):
                    parts.append(f"[{b.get('level','')}] {b['heading']}")
                if b.get("content"):
                    parts.append(b["content"])
            elif t == "list":
                items = b.get("items", [])
                if items:
                    parts.append("• " + "\n• ".join(items))
            elif t == "paragraph" and b.get("text"):
                parts.append(b["text"])
    text = "\n".join(parts)
    return text[:max_chars]


SYSTEM = """Kamu adalah HELIX Brand Profile Architect. Tugas lo:
baca isi website brand, lalu derive struktur brand profile yang konsisten dipakai
HELIX untuk generate content (Studio Plan/Brief/Hook/Caption).

OUTPUT JSON SCHEMA (HARUS PERSIS):
{
  "tagline": "1 kalimat pendek <12 kata, capture core promise/positioning",
  "positioning": "1 kalimat 'apa yang brand ini' — kategori + diferensiasi",
  "brand_voice": {
    "tone": ["3-5 adjective deskriptif tone bicara"],
    "language": "id" | "en",
    "style_notes": [
      "2-4 catatan style yang KHAS brand ini, bukan generik. Contoh: WhatsApp-first, formal akademik, kasual Gen-Z, dst"
    ]
  },
  "target_personas": [
    {"id": "slug-id", "label": "Label persona", "priority": "high"|"medium"|"low"}
  ],
  "content_strategy": {
    "content_pillars": [
      "4-6 pillar konten — judul pendek + 1 frasa konteks, format 'Pillar Name (konteks)'"
    ]
  }
}

PRINSIP:
- Bahasa output = bahasa utama brand (cek meta + isi). Kalau Indonesia → id, Inggris → en
- Tagline JANGAN copy dari website kalau panjang/awkward — distill ulang jadi punchy <12 kata
- Style notes harus SPECIFIC ke brand (e.g. "Bahasa formal pendidikan + emoji terbatas"), bukan
  generik kayak "profesional dan ramah"
- Content pillars harus EKSEKUTABEL untuk sosmed (bisa jadi reel/carousel/post). Jangan abstrak
  kayak "Brand awareness". Lebih ke "Tutor Spotlight", "Q&A Belajar", "Testimoni Siswa", dst
- Personas: 2-4 max. Priority "high" untuk segmen utama yang sering disebut di website
- Output JSON saja, no markdown code fence, no comment

KALAU website terlalu tipis/info kurang — tetap output schema lengkap, tapi pillars/personas
boleh ditebak konservatif berdasarkan kategori brand."""


def build_user_prompt(website_text: str) -> str:
    return f"""ISI WEBSITE (sudah di-extract dari scraping):
---
{website_text}
---

Generate brand profile JSON sesuai schema. Output JSON saja."""


def is_minimal(cfg: dict) -> bool:
    """Config dianggap minimal kalau gak punya brand_voice atau content_strategy."""
    return "brand_voice" not in cfg or "content_strategy" not in cfg


def merge_enrichment(cfg: dict, enrichment: dict) -> dict:
    """Merge enrichment ke config — jangan overwrite key existing kalau udah ada."""
    out = dict(cfg)
    for key in ("tagline", "positioning", "brand_voice", "target_personas"):
        if key not in out and key in enrichment:
            out[key] = enrichment[key]
    if "content_strategy" not in out and "content_strategy" in enrichment:
        out["content_strategy"] = enrichment["content_strategy"]
    return out


def enrich_one(brand_id: str) -> tuple[bool, str]:
    cfg_path = CONFIG_DIR / f"{brand_id}.config.json"
    if not cfg_path.exists():
        return False, "config not found"
    with cfg_path.open(encoding="utf-8") as f:
        cfg = json.load(f)
    if not is_minimal(cfg):
        return False, "already enriched (skip)"

    text = extract_website_text(brand_id)
    if not text:
        return False, "no website data"

    user = build_user_prompt(text)
    enrichment = _generate_json(SYSTEM, user, max_tokens=2000, model=PLAN_MODEL, temperature=0.4)

    merged = merge_enrichment(cfg, enrichment)
    with cfg_path.open("w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
    return True, f"OK — tagline: {enrichment.get('tagline','?')[:60]}"


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[1] == "--all":
        targets = []
        for path in sorted(CONFIG_DIR.glob("*.config.json")):
            with path.open(encoding="utf-8") as f:
                cfg = json.load(f)
            if is_minimal(cfg):
                targets.append(cfg["brand_id"])
    else:
        targets = argv[1:]

    if not targets:
        print("Usage: enrich_brand_profiles.py [brand_id ...] | --all")
        return 1

    print(f"Enriching {len(targets)} brand(s): {', '.join(targets)}")
    for bid in targets:
        print(f"\n→ {bid}")
        ok, msg = enrich_one(bid)
        status = "✓" if ok else "·"
        print(f"  {status} {msg}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
