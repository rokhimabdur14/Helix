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


# ========== Sprint 14c: Public-post diagnoser ==========
# Untuk URL post analysis di Sprint 14b — chain ke-2 setelah analyze_reference,
# kasih verdict "ramai/biasa/sepi" + reasoning + actionable tips.


PUBLIC_DIAGNOSIS_ROLE = """Kamu adalah HELIX Performance Diagnostician — ahli
judge post sosmed publik (post orang lain / kompetitor / inspirasi) dan
jelaskan KENAPA ramai atau sepi + kasih TIPS biar brand pengguna bisa
bikin konten serupa yang ramai.

Cara kerja kamu:
1. Liat angka publik (views/likes/comments) — kalau dibandingkan dengan
   thresholds umum + niche pattern + creator account size yang terlihat,
   apakah ini RAMAI (di atas average sosmed), BIASA (average), atau SEPI?
2. Jelaskan KENAPA — referensi visual hook, caption style, hook pattern,
   topic relevance, timing/seasonal fit
3. Bandingkan dengan brand pengguna (kalau brand context ada): apakah
   pattern post ini fit dengan voice + persona + pillar brand?
4. Kasih TIPS spesifik — bukan "buat konten bagus" generic — tapi
   "kalau brand kamu mau replikasi, ganti X jadi Y karena Z"

Threshold rough untuk verdict (sesuaikan dengan niche + account size kalau visible):
- Reel/Video views >100K + likes >5K = RAMAI (definitive)
- Reel views 10K-100K + ER >3% = RAMAI (moderate)
- Reel views <10K dan likes <500 = SEPI
- Carousel/Single image: likes >2K + comments >50 = RAMAI; <300 likes = SEPI
- ER tinggi (>5%) trump volume — niche kecil yang engage solid = RAMAI

Hindari hedge "bisa jadi" — kasih verdict tegas berdasarkan data terlihat."""


PUBLIC_DIAGNOSIS_SCHEMA = """Output JSON schema (semua field WAJIB ada):
{
  "performance_verdict": "ramai | biasa | sepi",
  "verdict_reason": "1-2 kalimat tegas: kenapa verdict-nya begitu. WAJIB reference angka spesifik dari engagement_signals + thresholds di atas.",
  "why_winning": [
    "Bullet konkret kenapa post ini work (visual hook, caption, niche fit, timing). Reference detail spesifik. Kalau verdict=sepi, isi []."
  ],
  "why_underperforming": [
    "Bullet konkret kenapa post ini gagal viral / sepi (hook lemah, caption kepanjangan, niche niche, posting timing, dst). Reference detail. Kalau verdict=ramai, isi []."
  ],
  "tips_for_brand": [
    "Tips konkret + spesifik untuk brand pengguna biar bikin konten serupa yang RAMAI. JANGAN generic — sebut nama hook, jenis pertanyaan, durasi, format yang harus dipakai. Maksimal 5 tips, pilih yang paling impactful."
  ],
  "brand_fit_note": "1 kalimat: pattern post ini cocok / tidak cocok dengan brand pengguna (refer voice + persona + pillar). Kalau brand context tidak ada, isi ''"
}"""


def _format_reference_block(ref_analysis: dict) -> str:
    """Format analyze_reference output jadi text block untuk prompt diagnose."""
    if not ref_analysis:
        return "(Data analisa post tidak tersedia)"

    eng = ref_analysis.get("engagement_signals") or {}
    lines = ["=== POST PUBLIK YANG DIANALISIS ==="]
    lines.append(f"Platform: {ref_analysis.get('platform', '?')}")
    lines.append(f"Format: {ref_analysis.get('format', '?')}")
    creator = ref_analysis.get("creator_handle") or ""
    if creator:
        lines.append(f"Creator handle: @{creator}")

    lines.append(f"\nEngagement signals (publik, dari screenshot):")
    lines.append(f"  Views: {eng.get('views', 'tidak terlihat')}")
    lines.append(f"  Likes: {eng.get('likes', 'tidak terlihat')}")
    lines.append(f"  Comments: {eng.get('comments', 'tidak terlihat')}")

    if ref_analysis.get("visual_summary"):
        lines.append(f"\nVisual: {ref_analysis['visual_summary']}")
    if ref_analysis.get("hook_or_first_frame"):
        lines.append(f"Hook/detik-1: {ref_analysis['hook_or_first_frame']}")
    if ref_analysis.get("caption_excerpt"):
        lines.append(f"Caption: {str(ref_analysis['caption_excerpt'])[:400]}")
    if ref_analysis.get("caption_style"):
        lines.append(f"Caption style: {ref_analysis['caption_style']}")
    if ref_analysis.get("hooks_pattern"):
        lines.append(f"Hook pattern: {ref_analysis['hooks_pattern']}")
    if ref_analysis.get("topic_or_pillar"):
        lines.append(f"Topic/pillar: {ref_analysis['topic_or_pillar']}")

    if ref_analysis.get("why_it_works"):
        lines.append(
            f"\nPattern observations (initial): "
            f"{' | '.join(ref_analysis['why_it_works'])}"
        )

    return "\n".join(lines)


def diagnose_public_post(
    ref_analysis: dict,
    brand_id: str | None = None,
) -> dict:
    """Diagnose URL post yang sudah di-analyze_reference.

    Chain LLM-2 yang kasih verdict ramai/biasa/sepi + actionable tips,
    optionally dengan brand context untuk personalisasi tips.

    Args:
        ref_analysis: output dari analyze_reference (REFERENCE_PROMPT schema)
        brand_id: kalau ada, inject brand DNA + benchmark untuk tips yang
            brand-specific. None = generic.

    Returns:
        dict {performance_verdict, verdict_reason, why_winning,
              why_underperforming, tips_for_brand, brand_fit_note,
              generated_at, brand_context_used}.
    """
    # Build brand context kalau ada
    brand_block = ""
    benchmark_used = False
    if brand_id:
        try:
            brand_profile = load_brand_profile(brand_id, max_chars=1800)
            if brand_profile:
                brand_block = f"\n=== BRAND PENGGUNA ===\n{brand_profile}"
        except Exception:
            pass
        try:
            _, bench_text = _load_brand_benchmark(brand_id)
            if bench_text:
                brand_block += f"\n{bench_text}"
                benchmark_used = True
        except Exception:
            pass

    expertise_text, _ = load_expertise(max_chars_per_file=600)
    expertise_block = (
        f"\n=== HELIX EXPERTISE (algoritma + storytelling) ===\n{expertise_text}"
        if expertise_text
        else ""
    )

    system = f"""{PUBLIC_DIAGNOSIS_ROLE}

ATURAN OUTPUT:
- Output WAJIB valid JSON sesuai schema yang diminta
- Bahasa Indonesia kasual-profesional
- Setiap bullet harus reference detail konkret dari post + brand context
- Tegas, bukan hedge — kasih verdict berdasarkan data yang terlihat
{expertise_block}{brand_block}
"""

    user = f"""{_format_reference_block(ref_analysis)}

Tugas: judge post ini RAMAI/BIASA/SEPI berdasarkan engagement signal +
threshold + niche fit. Jelaskan kenapa secara detail. Kasih tips konkret
biar brand pengguna bisa bikin konten serupa yang RAMAI.

{PUBLIC_DIAGNOSIS_SCHEMA}"""

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
        return {
            "performance_verdict": "biasa",
            "verdict_reason": f"Diagnosis gagal di-generate ({type(e).__name__}). Tetap bisa lihat pattern analysis di atas.",
            "why_winning": [],
            "why_underperforming": [],
            "tips_for_brand": [],
            "brand_fit_note": "",
            "generated_at": datetime.now().isoformat(),
            "brand_context_used": False,
            "error": str(e)[:200],
        }

    verdict = str(raw.get("performance_verdict") or "biasa").strip().lower()
    if verdict not in ("ramai", "biasa", "sepi"):
        verdict = "biasa"

    def _ensure_list(v):
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        return []

    return {
        "performance_verdict": verdict,
        "verdict_reason": str(raw.get("verdict_reason") or "").strip(),
        "why_winning": _ensure_list(raw.get("why_winning")),
        "why_underperforming": _ensure_list(raw.get("why_underperforming")),
        "tips_for_brand": _ensure_list(raw.get("tips_for_brand")),
        "brand_fit_note": str(raw.get("brand_fit_note") or "").strip(),
        "generated_at": datetime.now().isoformat(),
        "brand_context_used": bool(brand_id) and benchmark_used,
    }
