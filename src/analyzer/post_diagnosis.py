"""
HELIX — Per-Post Auto-Diagnosis
Given extracted metric + caption + brand DNA + brand benchmark + expertise,
LLM reasoning kenapa post high/low + actionable fix.

Dipanggil setelah screenshot extraction (atau bisa juga manual via /diagnose
endpoint untuk post existing yang ada di insights store).

Output JSON terstruktur untuk render di Analysis tab modal.
"""

import json
from datetime import datetime
from pathlib import Path

from src.ai.brain import DATA_DIR, client
from src.ai.studio import load_brand_profile, load_expertise, _load_social_context

# 8b instant: cukup untuk reasoning per-post (single context, gak multi-step
# kayak planner). Quota friendly (500K TPD), <2s response.
DIAGNOSIS_MODEL = "llama-3.1-8b-instant"


DIAGNOSIS_ROLE = """Kamu adalah HELIX Performance Diagnostician — ahli analisa
post sosmed dan jawab pertanyaan "kenapa post ini perform begini" + "apa
yang harus diperbaiki".

Cara kerja kamu:
1. Bandingkan metric post terhadap benchmark brand (rata-rata ER, top post)
2. Refer ke prinsip algoritma (TikTok/IG) + storytelling dari HELIX expertise
3. Lihat brand DNA (voice, target persona, pillar) — pesan brand match audience?
4. Output: KENAPA performanya begitu (data-driven) + FIX yang konkret &
   bisa langsung dieksekusi (BUKAN "perbaiki caption" — tapi "ganti
   pembukaan caption jadi pertanyaan langsung X")

Hindari saran generik. Setiap insight HARUS terkait sama data spesifik
post (angka, kata di caption, jam posting, pillar) dan brand context."""


def _load_brand_benchmark(brand_id: str) -> tuple[dict, str]:
    """Load benchmark agregat dari insights JSON existing.

    Returns:
        (raw_aggregates_dict, formatted_text_block)
        Kalau brand belum punya insights, return ({}, "").
    """
    path = DATA_DIR / f"{brand_id}_insights.json"
    if not path.exists():
        return {}, ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return {}, ""

    agg = data.get("aggregates") or {}
    if not agg:
        return {}, ""

    # Build compact text untuk prompt
    lines = ["=== BENCHMARK BRAND (rata-rata post historis) ==="]
    lines.append(f"Total post historis: {agg.get('post_count', 0)}")
    lines.append(f"Avg reach: {agg.get('avg_reach', 0):,.0f}")
    lines.append(f"Avg engagement rate: {agg.get('avg_engagement_rate', 0)}%")
    lines.append(f"Median ER: {agg.get('median_engagement_rate', 0)}%")

    by_type = agg.get("by_type") or {}
    if by_type:
        lines.append("\nPer type (post count, avg ER):")
        for t, s in by_type.items():
            lines.append(
                f"  - {t}: {s.get('count', 0)} post, ER {s.get('avg_engagement_rate', 0)}%"
            )

    by_pillar = agg.get("by_content_pillar") or {}
    if by_pillar:
        # Top 5 pillar by ER
        top_pillars = sorted(
            by_pillar.items(),
            key=lambda kv: kv[1].get("avg_engagement_rate", 0),
            reverse=True,
        )[:5]
        lines.append("\nPillar performance (sorted by ER):")
        for pl, s in top_pillars:
            lines.append(
                f"  - {pl[:40]}: {s.get('count', 0)} post, ER {s.get('avg_engagement_rate', 0)}%"
            )

    top_posts = agg.get("top_5_posts") or []
    if top_posts:
        lines.append("\nTop 5 post brand (sorted by ER):")
        for i, p in enumerate(top_posts, 1):
            lines.append(
                f"  {i}. [{p.get('type', '?')}] ER {p.get('engagement_rate', 0)}% "
                f"({p.get('content_pillar', '')}) — {p.get('caption_preview', '')[:80]}"
            )

    by_hour = agg.get("engagement_by_hour") or {}
    if by_hour:
        # Top 3 jam terbaik
        top_hours = sorted(by_hour.items(), key=lambda kv: kv[1], reverse=True)[:3]
        lines.append(
            "\nJam terbaik (top 3 by ER): "
            + ", ".join(f"{h} ({er}%)" for h, er in top_hours)
        )

    return agg, "\n".join(lines)


def _compute_post_er(row: dict) -> float:
    """Compute ER untuk post yang baru di-extract (belum di-enrich parser).

    Same formula dengan insights_parser.compute_engagement_rate.
    """
    try:
        reach = int(row.get("reach") or 0)
        if reach == 0:
            return 0.0
        likes = int(row.get("likes") or 0)
        comments = int(row.get("comments") or 0)
        saves = int(row.get("saves") or 0)
        shares = int(row.get("shares") or 0)
        return round(((likes + comments + saves + shares) / reach) * 100, 2)
    except (ValueError, TypeError):
        return 0.0


def _format_post_block(row: dict, computed_er: float) -> str:
    """Format post data jadi text block untuk prompt."""
    lines = ["=== POST YANG DIANALISIS ==="]
    lines.append(f"Type: {row.get('type', '?')}")
    lines.append(f"Date: {row.get('date') or '(tidak terlihat di screenshot)'}")
    lines.append(f"Posted time: {row.get('posted_time') or '(tidak terlihat)'}")
    if row.get("content_pillar"):
        lines.append(f"Pillar: {row['content_pillar']}")

    lines.append("\nMetric:")
    lines.append(f"  Reach: {row.get('reach', 0)}")
    lines.append(f"  Impressions/Plays: {row.get('impressions', 0)}")
    lines.append(f"  Likes: {row.get('likes', 0)}")
    lines.append(f"  Comments: {row.get('comments', 0)}")
    lines.append(f"  Saves: {row.get('saves', 0)}")
    lines.append(f"  Shares: {row.get('shares', 0)}")
    lines.append(f"  Profile visits: {row.get('profile_visits', 0)}")
    lines.append(f"  Follows from post: {row.get('follows', 0)}")
    lines.append(f"  Engagement Rate (computed): {computed_er}%")

    caption = (row.get("caption") or "").strip()
    if caption:
        lines.append(f"\nCaption ({len(caption)} char):")
        lines.append(caption[:800])
    else:
        lines.append("\nCaption: (tidak ada / tidak ke-extract)")

    # hashtags bisa list (post yang udah ke-enrich insights_parser) atau string
    # (row baru dari screenshot extractor sebelum di-parse).
    hashtags_raw = row.get("hashtags") or ""
    if isinstance(hashtags_raw, list):
        hashtags = " ".join(str(h) for h in hashtags_raw if h)
    else:
        hashtags = str(hashtags_raw).strip()
    if hashtags:
        lines.append(f"\nHashtags: {hashtags}")

    return "\n".join(lines)


DIAGNOSIS_SCHEMA = """Output JSON schema (semua field WAJIB ada):
{
  "summary": "1-2 kalimat verdict singkat. Mulai dengan 'Post ini perform di atas/di bawah/setara rata-rata brand karena <reason inti>'",
  "performance_band": "above_avg | avg | below_avg",
  "why_winning": [
    "Bullet konkret kenapa metric tertentu kuat (mention angka + reason). Kalau gak ada yang menonjol, isi [] kosong.",
    "..."
  ],
  "why_underperforming": [
    "Bullet konkret kenapa metric tertentu lemah (mention angka + reason). Kalau semua oke, isi [] kosong.",
    "..."
  ],
  "actionable_fixes": [
    "Saran konkret + spesifik. JANGAN generic. Contoh BAIK: 'Caption pembukaan terlalu generic — ganti kalimat pertama jadi pertanyaan retoris yang spesifik ke pain point persona (mis. \"Pernah handle 50 tamu sendirian?\")'. Contoh BURUK: 'Perbaiki caption'.",
    "..."
  ],
  "next_post_hint": "1 kalimat: kalau mau lanjut momentum (post bagus) atau recover (post jelek), arah konten berikutnya gimana?"
}"""


def diagnose_post(
    brand_id: str | None,
    row: dict,
    computed_er: float | None = None,
) -> dict:
    """Generate diagnosis untuk satu post.

    Args:
        brand_id: brand untuk load benchmark + DNA. None = free mode (cuma
            expertise + post data, gak ada benchmark).
        row: HELIX schema row (post_id, type, caption, reach, likes, dst).
        computed_er: ER pre-computed. None = compute dari row.

    Returns:
        dict sesuai DIAGNOSIS_SCHEMA + meta fields:
          - generated_at: ISO timestamp
          - benchmark_used: bool
    """
    if computed_er is None:
        computed_er = _compute_post_er(row)

    benchmark_agg, benchmark_block = _load_brand_benchmark(brand_id) if brand_id else ({}, "")
    benchmark_used = bool(benchmark_block)

    # Build system prompt: role + expertise + brand DNA + benchmark
    expertise_text, _ = load_expertise(max_chars_per_file=700)
    expertise_block = ""
    if expertise_text:
        expertise_block = (
            "\n=== HELIX EXPERTISE (algoritma + storytelling principle) ===\n"
            + expertise_text
        )

    brand_block = ""
    if brand_id:
        brand_profile = load_brand_profile(brand_id, max_chars=2000)
        social_dna = _load_social_context(brand_id, max_refs=2)
        brand_block = f"\n=== BRAND DNA ===\n{brand_profile}{social_dna}"

    benchmark_text = f"\n{benchmark_block}" if benchmark_block else (
        "\n=== BENCHMARK BRAND ===\n(Belum ada data historis. Analisa berbasis "
        "best-practice expertise + brand DNA saja.)"
    )

    system = f"""{DIAGNOSIS_ROLE}

ATURAN OUTPUT:
- Output WAJIB valid JSON sesuai schema yang diminta
- Bahasa Indonesia kasual-profesional
- Setiap bullet harus reference angka/teks konkret dari data post + benchmark
- JANGAN bilang "perform bagus" tanpa kasih kenapa secara data
- Maksimal 4 bullet per list, pilih yang paling impactful
{expertise_block}{brand_block}{benchmark_text}
"""

    post_block = _format_post_block(row, computed_er)
    user = f"""{post_block}

Tugas: analisa post di atas vs benchmark brand + best practice. Jawab dalam
JSON schema di bawah.

{DIAGNOSIS_SCHEMA}"""

    try:
        resp = client.chat.completions.create(
            model=DIAGNOSIS_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.5,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        raw = json.loads(resp.choices[0].message.content)
    except Exception as e:
        # Diagnosis gagal — return shape valid dengan error info, biar UI tetap render
        return {
            "summary": f"Diagnosis gagal di-generate ({type(e).__name__}). Metric tetap tersimpan.",
            "performance_band": "avg",
            "why_winning": [],
            "why_underperforming": [],
            "actionable_fixes": [],
            "next_post_hint": "",
            "generated_at": datetime.now().isoformat(),
            "benchmark_used": benchmark_used,
            "error": str(e)[:200],
        }

    # Validate + normalize shape
    band = str(raw.get("performance_band") or "avg").strip().lower()
    if band not in ("above_avg", "avg", "below_avg"):
        band = "avg"

    def _ensure_list(v):
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        return []

    return {
        "summary": str(raw.get("summary") or "").strip(),
        "performance_band": band,
        "why_winning": _ensure_list(raw.get("why_winning")),
        "why_underperforming": _ensure_list(raw.get("why_underperforming")),
        "actionable_fixes": _ensure_list(raw.get("actionable_fixes")),
        "next_post_hint": str(raw.get("next_post_hint") or "").strip(),
        "generated_at": datetime.now().isoformat(),
        "benchmark_used": benchmark_used,
    }
