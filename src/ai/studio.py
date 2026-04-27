"""
HELIX — Content Studio
AI content generators for social media: hooks, captions, carousels, etc.

Setiap generator pakai Groq JSON mode supaya output terstruktur dan bisa
di-render di UI sebagai komponen (bukan plain text).
"""

import json
from pathlib import Path
from typing import Literal

from src.ai.brain import CONFIG_DIR, DATA_DIR, client

# Studio pakai model yang lebih kecil & cepat (8b):
# - Rate limit lebih besar (500K TPD vs 100K untuk 70b)
# - Creative writing tidak perlu reasoning kompleks
# - Lebih hemat quota untuk power users
STUDIO_MODEL = "llama-3.1-8b-instant"

# Planning butuh reasoning multi-step (pillar mix, balance format, sequencing)
# jadi pakai model 70b walaupun lebih lambat. Volume rendah (1 plan/minggu).
PLAN_MODEL = "llama-3.3-70b-versatile"

# ========== Shared helper ==========

EXPERTISE_DIR = DATA_DIR / "expertise"


def load_expertise(max_chars_per_file: int = 1500) -> tuple[str, list[dict]]:
    """Load semua expertise markdown files di data/expertise/.

    Returns:
        (combined_text, manifest) — combined text untuk dipakai di prompt,
        manifest [{slug, label}] untuk dipakai di endpoint /expertise.
    """
    if not EXPERTISE_DIR.exists():
        return "", []

    parts = []
    manifest = []
    for md_file in sorted(EXPERTISE_DIR.glob("*.md")):
        if md_file.name == "index.md":
            continue
        try:
            content = md_file.read_text(encoding="utf-8")
        except Exception:
            continue

        # Parse YAML-style frontmatter (slug, label)
        slug = md_file.stem
        label = slug
        body = content
        if content.startswith("---"):
            end = content.find("---", 3)
            if end > 0:
                fm = content[3:end]
                body = content[end + 3:].lstrip()
                for line in fm.splitlines():
                    if ":" in line:
                        k, v = line.split(":", 1)
                        k, v = k.strip(), v.strip()
                        if k == "slug":
                            slug = v
                        elif k == "label":
                            label = v

        manifest.append({"slug": slug, "label": label})

        if len(body) > max_chars_per_file:
            body = body[:max_chars_per_file] + "\n[...truncated...]"
        parts.append(f"### EXPERTISE: {label}\n{body}")

    return "\n\n".join(parts), manifest


def load_brand_profile(brand_id: str, max_chars: int = 6000) -> str:
    """Compressed brand profile untuk studio tools.

    Hanya config + homepage content (bukan full website scrape).
    Target: <2000 tokens supaya muat di 8b model rate limit.
    """
    parts = []

    config_path = CONFIG_DIR / f"{brand_id}.config.json"
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        parts.append("=== BRAND ===")
        parts.append(json.dumps(config, ensure_ascii=False, indent=2))

    # Homepage content only (skip service detail pages to save tokens)
    website_path = DATA_DIR / f"{brand_id}_website.json"
    if website_path.exists():
        with open(website_path, "r", encoding="utf-8") as f:
            website = json.load(f)
        for page in website.get("pages", []):
            url = page["url"]
            path = url.split("/", 3)[-1] if url.count("/") > 2 else "/"
            if path in ("", "/", "about", "about-us", "tentang"):
                parts.append(f"\n=== {url} ===")
                for b in page.get("blocks", [])[:15]:  # cap per page
                    if b.get("type") == "section":
                        parts.append(f"## {b.get('heading', '')}")
                        if b.get("content"):
                            parts.append(b["content"][:400])
                    elif b.get("type") == "paragraph":
                        parts.append(b["content"][:400])

    result = "\n".join(parts)
    if len(result) > max_chars:
        result = result[:max_chars] + "\n[...truncated...]"
    return result


def _system_prompt_with_brand(brand_id: str, role_intro: str) -> str:
    """Build system prompt: role intro + expertise + brand profile."""
    # Compress brand profile lebih agresif krn expertise dibawa juga
    profile = load_brand_profile(brand_id, max_chars=3500)
    expertise_text, _ = load_expertise()

    expertise_block = ""
    if expertise_text:
        expertise_block = f"""

=== HELIX EXPERTISE (knowledge base umum, pakai sebagai prinsip) ===
{expertise_text}
"""

    return f"""{role_intro}

ATURAN OUTPUT:
- Output WAJIB valid JSON sesuai schema yang diminta
- Bahasa Indonesia kasual-profesional (boleh campur istilah marketing Inggris)
- Gunakan emoji secukupnya untuk readability
- Spesifik untuk brand — pakai fakta dari data brand di bawah
- JANGAN kasih konten generik yang bisa dipakai brand manapun
- Terapkan prinsip dari HELIX expertise (algoritma, growth tactics) saat relevan
{expertise_block}
=== DATA BRAND ===
{profile}
"""


def _generate_json(
    system: str,
    user: str,
    max_tokens: int = 2048,
    model: str = STUDIO_MODEL,
    temperature: float = 0.8,
) -> dict:
    """Call Groq with JSON response_format, return parsed dict."""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    return json.loads(content)


# ========== 1. Hook Generator ==========

HOOK_ROLE = """Kamu adalah HELIX Hook Specialist — ahli bikin 3-detik pertama
video sosmed yang bikin viewer stop scrolling. Kamu paham psikologi attention,
pattern interrupt, dan curiosity gap."""


def generate_hooks(
    brand_id: str,
    topic: str,
    format_type: Literal["reel", "tiktok", "story"] = "reel",
    count: int = 5,
) -> dict:
    """Generate scroll-stopping hooks untuk video.

    Returns:
        {"hooks": [{"text": "...", "type": "question|shock|promise|story",
                     "reasoning": "..."}]}
    """
    system = _system_prompt_with_brand(brand_id, HOOK_ROLE)
    user = f"""Buat {count} hook (3-5 detik pertama) untuk video {format_type.upper()} tentang:

TOPIK: {topic}

Setiap hook harus:
- Maksimal 15 kata
- Bikin orang berhenti scrolling di detik pertama
- Bervariasi jenis (question / shock / promise / story / contrarian)

Output JSON schema:
{{
  "hooks": [
    {{
      "text": "hook text yang diucapkan/ditulis",
      "type": "question|shock|promise|story|contrarian",
      "reasoning": "kenapa hook ini works untuk brand ini (1 kalimat)"
    }}
  ]
}}"""

    return _generate_json(system, user, max_tokens=1500)


# ========== 2. Caption Generator ==========

CAPTION_ROLE = """Kamu adalah HELIX Caption Writer — ahli bikin caption IG yang
drive engagement (like, save, comment, share). Kamu paham hook line di awal,
struktur storytelling, dan CTA yang convert."""


def generate_caption(
    brand_id: str,
    post_context: str,
    goal: Literal["awareness", "engagement", "sales", "education"] = "engagement",
    length: Literal["short", "medium", "long"] = "medium",
) -> dict:
    """Generate Instagram caption.

    Returns:
        {"hook": "...", "body": "...", "cta": "...",
         "hashtags": ["#..."], "alt_versions": ["..."]}
    """
    length_guide = {
        "short": "1-2 kalimat, max 150 karakter (buat reel/carousel viral)",
        "medium": "3-5 baris, storytelling singkat (buat feed post normal)",
        "long": "7-15 baris, full storytelling dengan edu value (buat carousel edukasi)",
    }

    goal_guide = {
        "awareness": "Fokus ke brand introduction + memorable tagline",
        "engagement": "Fokus ke question/discussion, pancing comment",
        "sales": "Fokus ke benefit + urgency + soft CTA ke DM/WA",
        "education": "Fokus ke value/insight, positioning expert",
    }

    system = _system_prompt_with_brand(brand_id, CAPTION_ROLE)
    user = f"""Buat caption Instagram untuk post ini:

KONTEKS POST: {post_context}
GOAL: {goal} — {goal_guide[goal]}
LENGTH: {length} — {length_guide[length]}

Output JSON schema:
{{
  "hook": "kalimat pertama (max 10 kata) yang bikin orang berhenti scroll & click 'more'",
  "body": "isi caption lengkap (tanpa hook, tanpa CTA, tanpa hashtag)",
  "cta": "call to action di akhir (ajak DM, save, comment, share, dll)",
  "hashtags": ["#hashtag1", "#hashtag2", "..."],
  "alt_versions": [
    "caption alternatif 1 (gaya beda)",
    "caption alternatif 2 (gaya beda)"
  ]
}}

Hashtag: mix niche + medium + broad (10-15 total). Relevan dengan brand, bukan generic."""

    return _generate_json(system, user, max_tokens=2000)


# ========== 3. Carousel Generator ==========

CAROUSEL_ROLE = """Kamu adalah HELIX Carousel Designer — ahli bikin Instagram
carousel yang punya narrative arc kuat: hook slide pertama, value di tengah,
CTA slide terakhir. Kamu paham swipe psychology."""


def generate_carousel(
    brand_id: str,
    topic: str,
    num_slides: int = 5,
    goal: Literal["education", "storytelling", "listicle", "promotion"] = "education",
) -> dict:
    """Generate Instagram carousel (multi-slide).

    Returns:
        {"title": "...", "slides": [{"slide_num": 1, "headline": "...",
          "body": "...", "visual_hint": "..."}], "caption": "..."}
    """
    num_slides = max(3, min(num_slides, 10))

    goal_guide = {
        "education": "Setiap slide = 1 insight/tip. Slide terakhir summary/CTA.",
        "storytelling": "Narrative arc: setup → conflict → solution → CTA",
        "listicle": "Slide 1 hook judul, slide 2-N = 1 item list, slide terakhir CTA",
        "promotion": "Slide 1 problem, slide 2-N benefit/solution, slide terakhir offer+CTA",
    }

    system = _system_prompt_with_brand(brand_id, CAROUSEL_ROLE)
    user = f"""Buat Instagram carousel {num_slides} slides tentang:

TOPIK: {topic}
GOAL: {goal} — {goal_guide[goal]}

Aturan:
- Slide 1 = HOOK yang bikin orang swipe (judul max 8 kata + body 1 kalimat)
- Slide 2 s/d {num_slides - 1} = CONTENT (value/story/list)
- Slide {num_slides} = CTA (ajak save, follow, DM, dll)
- Setiap slide: headline < 10 kata, body < 30 kata (ringkas, carousel bukan blog)
- Visual hint: saran gambar/design untuk slide itu (brand-relevant, konkret)

Output JSON schema:
{{
  "title": "judul carousel (untuk reference internal, tidak tampil di IG)",
  "slides": [
    {{
      "slide_num": 1,
      "headline": "judul besar di slide",
      "body": "teks isi slide (ringkas)",
      "visual_hint": "saran visual untuk slide ini"
    }}
  ],
  "caption": "caption IG untuk post carousel ini (3-5 baris + 10 hashtags)"
}}"""

    return _generate_json(system, user, max_tokens=3000)


# ========== 4. Content Plan (kalender konten) ==========

PLAN_ROLE = """Kamu adalah HELIX Content Strategist — ahli bikin kalender konten
sosmed mingguan/bulanan yang bukan random posting. Kamu paham content pillar mix,
sequencing (awareness → engagement → sales), variasi format, dan posting cadence.

Kamu mikir seperti social media manager senior: setiap post punya tujuan strategis,
saling support post lain, dan match dengan brand voice."""


def _load_brand_insights(brand_id: str) -> str | None:
    """Load top performing pillars/formats jika ada insights data."""
    insights_path = DATA_DIR / f"{brand_id}_insights.json"
    if not insights_path.exists():
        return None
    try:
        with open(insights_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        agg = data.get("aggregates") or {}
        top_pillars = agg.get("top_pillars") or agg.get("by_pillar") or {}
        top_formats = agg.get("top_formats") or agg.get("by_format") or {}
        if not (top_pillars or top_formats):
            return None
        parts = ["=== INSIGHTS DARI POST LAMA ==="]
        if top_pillars:
            parts.append(f"Top pillars: {json.dumps(top_pillars, ensure_ascii=False)[:500]}")
        if top_formats:
            parts.append(f"Top formats: {json.dumps(top_formats, ensure_ascii=False)[:500]}")
        return "\n".join(parts)
    except Exception:
        return None


def generate_plan(
    brand_id: str,
    period: Literal["week", "month"] = "week",
    posts_per_week: int = 4,
    start_date: str | None = None,
    goals: list[str] | None = None,
    theme: str | None = None,
) -> dict:
    """Generate content calendar (weekly/monthly) untuk brand.

    Returns:
        {"period": "week|month", "start_date": "...", "end_date": "...",
         "strategy": "...", "pillars": [...],
         "posts": [{"date": "YYYY-MM-DD", "day": "...", "time": "HH:MM",
                    "format": "reel|carousel|story|feed",
                    "pillar": "...", "topic": "...",
                    "hook_idea": "...", "caption_angle": "...",
                    "visual_idea": "...", "goal": "..."}]}
    """
    from datetime import date, datetime, timedelta

    if start_date:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
    else:
        start = date.today()

    weeks = 1 if period == "week" else 4
    posts_per_week = max(2, min(posts_per_week, 7))
    total_posts = posts_per_week * weeks
    end = start + timedelta(days=7 * weeks - 1)

    goals_text = (
        ", ".join(goals)
        if goals
        else "balanced mix (awareness, engagement, education, sales)"
    )

    insights_section = _load_brand_insights(brand_id)
    insights_block = f"\n\n{insights_section}" if insights_section else ""

    theme_clean = (theme or "").strip()
    theme_block = ""
    if theme_clean:
        theme_block = f"""

TEMA KONTEN PERIODE INI: {theme_clean}

Aturan tema (WAJIB diikuti):
- Sebelum bikin post, scan dulu DATA BRAND + HELIX EXPERTISE + INSIGHTS post lama untuk cari angle/insight/data point yang paling nyambung dengan tema ini
- SETIAP post harus orbit ke tema ini (boleh angle berbeda: edukasi, BTS, testimonial, problem-solution, comparison, dst — tapi semua nyambung tema)
- "hook_idea" tiap post HARUS specific untuk tema, bukan hook generik. Variasi tipe hook (question / shock stat / contrarian / story / promise) tapi semua nyambung tema
- Pillars yang dipilih harus mendukung tema (bukan pillar random brand)
- Strategy paragraph di output harus jelaskan: kenapa tema ini cocok untuk brand sekarang, angle apa dari brand knowledge yang dipakai, dan flow narasi minggu/bulan mengarah ke mana"""

    user = f"""Buat content calendar untuk:

PERIOD: {period} ({weeks} minggu, {start.isoformat()} s/d {end.isoformat()})
POSTS: {total_posts} posts total ({posts_per_week} per minggu)
GOALS: {goals_text}{theme_block}

Aturan:
- Setiap post WAJIB punya tanggal dalam range di atas (format YYYY-MM-DD)
- Spread evenly — jangan numpuk di satu hari
- Jam posting realistis untuk Indonesia (07-09 pagi, 12-13 siang, 19-21 malam)
- Variasi format: mix reel, carousel, feed, story (jangan semua reel)
- Variasi pillar: jangan 5 post berturut-turut topik yang sama
- Sequence cerdas: awareness dulu, baru engagement, baru sales push
- Strategy paragraf di awal: 2-3 kalimat overview kenapa kalender ini ngarah ke goal

Output JSON schema:
{{
  "period": "{period}",
  "start_date": "{start.isoformat()}",
  "end_date": "{end.isoformat()}",
  "strategy": "Overview strategi minggu/bulan ini (2-3 kalimat). Kenapa pillar mix & sequencing ini work untuk brand.",
  "pillars": ["pillar 1", "pillar 2", "pillar 3"],
  "posts": [
    {{
      "date": "YYYY-MM-DD",
      "day": "Senin|Selasa|...",
      "time": "HH:MM",
      "format": "reel|carousel|feed|story",
      "pillar": "nama pillar",
      "topic": "topik singkat post (1 kalimat)",
      "hook_idea": "hook 1 kalimat untuk awal post",
      "caption_angle": "angle caption (1 kalimat)",
      "visual_idea": "saran visual/shot (1 kalimat)",
      "goal": "awareness|engagement|sales|education"
    }}
  ]
}}"""

    return _generate_json(
        system,
        user,
        max_tokens=4000,
        model=PLAN_MODEL,
        temperature=0.7,
    )
