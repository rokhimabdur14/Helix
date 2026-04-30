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


def _load_social_context(brand_id: str, max_refs: int = 6) -> str:
    """Compose social profile aesthetic + top references untuk inject ke prompt.

    Lazy import dari src.social.storage supaya gak nyiptain circular dependency
    saat startup.
    """
    try:
        from src.social import storage as social_storage
    except ImportError:
        return ""

    blocks = []

    # Profile snapshots (per platform — IG + TT terpisah)
    profile = social_storage.load_profile(brand_id)
    ready_snaps = [s for s in profile.get("snapshots", []) if s.get("status") == "ready"]
    for snap in ready_snaps:
        ana = snap.get("analysis", {})
        if not ana:
            continue
        line = (
            f"--- {snap['platform'].upper()} @{snap['handle']} ---\n"
            f"Vibe: {ana.get('vibe', 'n/a')}\n"
            f"Color palette: {', '.join(ana.get('color_palette', []))}\n"
            f"Editing style: {ana.get('editing_style', 'n/a')}\n"
            f"Consistency: {ana.get('consistency_score', 'n/a')} — {ana.get('consistency_reason', '')}\n"
            f"Content themes: {ana.get('content_themes', [])}\n"
            f"Format mix: {ana.get('format_mix', {})}\n"
            f"Key observations: {' | '.join(ana.get('key_observations', []))}"
        )
        blocks.append(line)

    # Reference library (cap top N, prioritize "own" + "inspiration" tag)
    refs = social_storage.load_references(brand_id)
    ready_refs = [r for r in refs.get("references", []) if r.get("status") == "ready"]
    # Prioritize own + inspiration over competitor
    priority = {"own": 0, "inspiration": 1, "competitor": 2}
    ready_refs.sort(key=lambda r: priority.get(r.get("tag", "inspiration"), 3))
    for r in ready_refs[:max_refs]:
        ana = r.get("analysis", {})
        if not ana:
            continue
        line = (
            f"--- REF [{r.get('tag', 'inspiration')}] {r.get('platform', '')} ---\n"
            f"URL: {r.get('url')}\n"
            f"Format: {ana.get('format', 'n/a')} | Topic: {ana.get('topic_or_pillar', 'n/a')}\n"
            f"Visual: {ana.get('visual_summary', 'n/a')}\n"
            f"Hook/first frame: {ana.get('hook_or_first_frame', 'n/a')}\n"
            f"Hook pattern: {ana.get('hooks_pattern', 'n/a')}\n"
            f"Caption excerpt: {ana.get('caption_excerpt', '-')[:160]}\n"
            f"Why it works: {' | '.join(ana.get('why_it_works', []))}\n"
            f"Replication angle: {ana.get('replication_angle', 'n/a')}"
        )
        blocks.append(line)

    if not blocks:
        return ""
    body = "\n\n".join(blocks)
    return f"""

=== SOCIAL DNA (visual analysis dari profile sosmed brand + reference library yang user pilih) ===
{body}

PENTING: pas generate konten, ambil cue dari SOCIAL DNA di atas — match aesthetic
brand sendiri, dan replicate pattern dari reference yang user kurasi (terutama
yang tag "inspiration" / "own"). Jangan jadi generik."""


def _system_prompt_with_brand(brand_id: str, role_intro: str, compact: bool = False) -> str:
    """Build system prompt: role intro + expertise + brand profile + social DNA.

    compact=True (untuk model 8b TPM 6000): trim hard biar request muat.
    """
    if compact:
        profile = load_brand_profile(brand_id, max_chars=1400)
        expertise_text, _ = load_expertise(max_chars_per_file=500)
        social_block = _load_social_context(brand_id, max_refs=2)
    else:
        profile = load_brand_profile(brand_id, max_chars=3500)
        expertise_text, _ = load_expertise()
        social_block = _load_social_context(brand_id)

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
{profile}{social_block}
"""


def _system_prompt_free(role_intro: str, compact: bool = False) -> str:
    """Free-mode system prompt: HELIX expertise only, no brand context.

    Dipakai saat user akses Studio tanpa pilih brand (mirip Free Chat).
    Output tetap solid karena role + expertise + user-supplied topic
    udah cukup bahan, tapi gak punya brand DNA jadi otomatis lebih generic.
    User bertanggung jawab kasih konteks (topic, angle) yang detail.

    compact=True: expertise di-truncate lebih agresif untuk model 8b TPM 6000.
    """
    expertise_text, _ = load_expertise(max_chars_per_file=500 if compact else 1500)
    expertise_block = ""
    if expertise_text:
        expertise_block = f"""

=== HELIX EXPERTISE (knowledge base umum, pakai sebagai prinsip) ===
{expertise_text}
"""

    return f"""{role_intro}

ATURAN OUTPUT (FREE MODE — tanpa brand context):
- Output WAJIB valid JSON sesuai schema yang diminta
- Bahasa Indonesia kasual-profesional (boleh campur istilah marketing Inggris)
- Gunakan emoji secukupnya untuk readability
- Karena belum ada brand context, ekstrak SEMUA cue dari topik/input user
- Kalau topik ambigu, kasih versi paling reusable + sebut asumsi yang dipakai
- Terapkan prinsip dari HELIX expertise (algoritma, growth tactics, storytelling)
- Jangan invent fakta brand spesifik (nama, harga, lokasi) — stay topic-grounded
{expertise_block}"""


def _system_prompt(brand_id: str | None, role_intro: str, compact: bool = False) -> str:
    """Pick brand-aware atau free system prompt based on brand_id.

    compact=True: trim expertise/profile/social biar muat di 8b TPM (6000 token).
    """
    if brand_id:
        return _system_prompt_with_brand(brand_id, role_intro, compact=compact)
    return _system_prompt_free(role_intro, compact=compact)


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
    brand_id: str | None,
    topic: str,
    format_type: Literal["reel", "tiktok", "story"] = "reel",
    count: int = 5,
) -> dict:
    """Generate scroll-stopping hooks untuk video.

    brand_id None = free mode (HELIX expertise only, no brand DNA).

    Returns:
        {"hooks": [{"text": "...", "type": "question|shock|promise|story",
                     "reasoning": "..."}]}
    """
    system = _system_prompt(brand_id, HOOK_ROLE)
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
    brand_id: str | None,
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

    system = _system_prompt(brand_id, CAPTION_ROLE)
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
    brand_id: str | None,
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

    system = _system_prompt(brand_id, CAROUSEL_ROLE)
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
    brand_id: str | None,
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

    # Insights cuma ada per-brand; di free mode skip
    insights_section = _load_brand_insights(brand_id) if brand_id else None
    insights_block = f"\n\n{insights_section}" if insights_section else ""

    system = _system_prompt(brand_id, PLAN_ROLE) + insights_block

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


# ========== 5. Brief (unified per-post) ==========

BRIEF_ROLE = """Kamu adalah HELIX Content Brief Director — ahli bikin brief eksekusi
untuk SATU post sosmed. Output kamu adalah dokumen produksi siap-eksekusi: bukan ide
mentah, bukan strategi panjang — tapi instruksi konkret yang bisa dieksekusi sama
content creator atau editor video tanpa nanya balik.

Kamu integrate 3 hal:
1. STORYTELLING (Conceptual / Communications / Crafting + Feel-Think-Do-Tell)
2. ALGORITMA (hook 3-detik, completion rate, posting time)
3. BRAND DNA (voice, aesthetic, pillars, footage realism)

PRINSIP KERJA:
- Brief yang lo buat HARUS realistis sesuai footage/aset yang brand punya
- Hook + twist wajib ada (Dimas Djay framework: hook tahan, twist surprise di tengah/akhir)
- Setiap field punya alasan strategis — gak random
- Spesifik untuk brand, pakai fakta dari brand profile + social DNA"""


def _load_specific_references(brand_id: str, ref_ids: list[str] | None) -> str:
    """Load reference yang user pilih spesifik untuk brief ini.

    Berbeda dari _load_social_context yang ambil top-N umum, ini ambil refs
    yang user explicit pilih (untuk mode tiru/modifikasi).
    """
    if not ref_ids:
        return ""
    try:
        from src.social import storage as social_storage
    except ImportError:
        return ""

    refs = social_storage.load_references(brand_id)
    by_id = {r.get("id"): r for r in refs.get("references", [])}
    blocks = []
    for rid in ref_ids:
        r = by_id.get(rid)
        if not r or r.get("status") != "ready":
            continue
        ana = r.get("analysis") or {}
        if not ana:
            continue
        blocks.append(
            f"--- TARGETED REFERENCE [{r.get('tag', 'inspiration')}] ---\n"
            f"URL: {r.get('url')}\n"
            f"Format: {ana.get('format', 'n/a')}\n"
            f"Visual: {ana.get('visual_summary', 'n/a')}\n"
            f"Hook/first frame: {ana.get('hook_or_first_frame', 'n/a')}\n"
            f"Hook pattern: {ana.get('hooks_pattern', 'n/a')}\n"
            f"Caption excerpt: {ana.get('caption_excerpt', '-')[:300]}\n"
            f"Why it works: {' | '.join(ana.get('why_it_works', []))}\n"
            f"Replication angle: {ana.get('replication_angle', 'n/a')}"
        )
    if not blocks:
        return ""
    return "\n\n=== REFERENSI TARGET (yang user PILIH SENDIRI buat brief ini) ===\n" + "\n\n".join(blocks)


def _brief_user_prompt(
    *,
    format_type: str,
    mode: str,
    topic: str,
    angle: str | None,
    pillar: str | None,
    goal: str | None,
    reference_text: str | None,
    targeted_refs_block: str,
    chosen_title: str | None = None,
    scene_count: int | None = None,
) -> str:
    """Build format-aware user prompt + JSON schema."""
    mode_guide = {
        "tiru": "TIRU pattern dari REFERENSI TARGET — ambil struktur narasi/hook/visual cue, tapi ganti substansi & brand-fit Fotofusi/brand ini",
        "modifikasi": "MODIFIKASI referensi target — pakai kerangka pattern, tapi belokin angle/twist sesuai catatan custom di bawah",
        "original": "ORIGINAL — gak ada referensi specific, fresh dari brand DNA + topik",
    }
    mode_text = mode_guide.get(mode, mode_guide["original"])

    angle_block = f"\nCUSTOM ANGLE: {angle}" if angle else ""
    pillar_block = f"\nPILLAR: {pillar}" if pillar else ""
    goal_block = f"\nGOAL: {goal}" if goal else ""
    ref_text_block = (
        f"\n\n=== REFERENSI MANUAL (deskripsi user) ===\n{reference_text}"
        if reference_text
        else ""
    )
    title_block = (
        f"""

=== JUDUL TERPILIH (LOCKED — wajib pakai persis) ===
"{chosen_title}"

Aturan:
- output `title` field WAJIB sama persis dengan judul di atas
- Hook, narrative_arc, scenes, caption — semua harus nyambung & mendukung judul ini
- Jangan bikin judul beda/variasi"""
        if chosen_title
        else ""
    )
    scene_count_block = ""
    if scene_count and format_type == "reel":
        n = max(3, min(int(scene_count), 10))
        scene_count_block = f"""

=== SCENE COUNT (LOCKED) ===
Output `scenes` array WAJIB exactly {n} item (tidak boleh kurang/lebih).
Distribusi durasi total tetap 15-45 detik, bagi rata sesuai jumlah scene."""

    common_input = f"""TOPIK: {topic}
FORMAT: {format_type}
MODE: {mode} — {mode_text}{angle_block}{pillar_block}{goal_block}{ref_text_block}{targeted_refs_block}{title_block}{scene_count_block}"""

    if format_type == "reel":
        schema_json = """{
  "format": "reel",
  "goal": "awareness|engagement|sales|education",
  "title": "judul internal brief (max 10 kata, untuk reference)",
  "narrative_arc": {
    "feel": "1 kalimat — emosi/curiosity yang dipancing di awal",
    "think": "1 kalimat — insight/decision yang ditanam di tengah",
    "do": "1 kalimat — action yang dipancing dari viewer",
    "tell": "1 kalimat — kenapa viewer bakal share/save ini"
  },
  "hooks": [
    {"text": "hook 1 (max 12 kata, ucapan/teks)", "visual": "visual frame 1 detik pertama", "type": "question|shock|promise|story|contrarian"},
    {"text": "hook 2 (variasi tipe beda)", "visual": "...", "type": "..."},
    {"text": "hook 3 (variasi tipe beda lagi)", "visual": "...", "type": "..."}
  ],
  "twist": "twist visual atau copy di tengah/akhir reel — 1 kalimat",
  "scenes": [
    {"no": 1, "duration_s": 3, "visual": "deskripsi shot konkret", "voiceover": "VO/narasi (kosong kalau silent)", "on_screen_text": "teks layar"},
    "... 5-8 scenes total, durasi total 15-45 detik"
  ],
  "caption": "caption IG/TikTok lengkap (3-7 baris, hook line di awal, body, soft pre-CTA)",
  "cta": "call to action 1 kalimat (DM/save/comment/follow)",
  "hashtags": ["#hashtag1 (mix niche+medium+broad, 8-12 total)", "..."],
  "best_posting_time": "HH:MM (jam Indonesia, alasan singkat di exec_notes)",
  "exec_notes": "catatan eksekusi: footage yang dibutuhkan, apakah bisa pakai stock/footage existing, music/audio recommendation, BTS option, alasan posting time"
}"""
        return f"""Buat BRIEF EKSEKUSI lengkap untuk REEL/video pendek:

{common_input}

ATURAN OUTPUT:
- 5-8 scene (total durasi 15-45 detik)
- Hook 3 alternatif WAJIB variasi tipe (jangan 3-3nya question)
- narrative_arc pakai framework Feel-Think-Do-Tell (Dimas Djay)
- twist WAJIB ada (visual atau kata-kata) — bikin tahan completion rate
- exec_notes wajib jujur soal feasibility footage (cek brand DNA: stock vs real footage)

Output JSON valid:
{schema_json}"""

    elif format_type == "carousel_foto":
        schema_json = """{
  "format": "carousel_foto",
  "goal": "awareness|engagement|sales|education",
  "title": "judul internal carousel",
  "narrative_arc": {
    "feel": "...", "think": "...", "do": "...", "tell": "..."
  },
  "slides": [
    {"no": 1, "type": "cover", "headline": "judul besar (max 8 kata)", "body": "subheading 1 kalimat", "visual": "deskripsi visual cover"},
    {"no": 2, "type": "content", "headline": "...", "body": "isi slide (max 30 kata)", "visual": "..."},
    "... 4-7 slides content, slide terakhir type=cta",
    {"no": 7, "type": "cta", "headline": "...", "body": "...", "visual": "..."}
  ],
  "caption": "caption IG (3-5 baris)",
  "cta": "...",
  "hashtags": ["#..."],
  "best_posting_time": "HH:MM",
  "exec_notes": "color palette saran, font/template, footage yang dipakai"
}"""
        return f"""Buat BRIEF EKSEKUSI lengkap untuk CAROUSEL FOTO Instagram:

{common_input}

ATURAN OUTPUT:
- Slide 1 = cover (hook visual + headline kuat)
- Slide 2 s/d N-1 = content (1 insight/poin per slide, body max 30 kata — carousel bukan blog)
- Slide terakhir = CTA
- 5-8 slide total
- narrative_arc pakai Feel-Think-Do-Tell

Output JSON valid:
{schema_json}"""

    elif format_type == "single_foto":
        schema_json = """{
  "format": "single_foto",
  "goal": "awareness|engagement|sales|education",
  "title": "judul internal",
  "visual_direction": "deskripsi shot/komposisi/styling untuk foto utama (1 paragraf konkret)",
  "hook_options": ["hook caption opsi 1 (max 12 kata, kalimat pertama caption)", "opsi 2 (variasi)", "opsi 3 (variasi)"],
  "caption": "caption full-length (5-12 baris, story-driven, pakai 1 dari hook_options sebagai opening)",
  "cta": "call to action 1 kalimat",
  "hashtags": ["#..."],
  "best_posting_time": "HH:MM",
  "exec_notes": "props, location, lighting, editing tone, alasan posting time"
}"""
        return f"""Buat BRIEF EKSEKUSI lengkap untuk SINGLE PHOTO Instagram/feed:

{common_input}

ATURAN OUTPUT:
- visual_direction harus konkret (komposisi, lighting, styling) — bukan generic "estetik"
- 3 hook caption opsi WAJIB variasi tipe
- Caption full pakai 1 dari hook (sisanya alternatif)

Output JSON valid:
{schema_json}"""

    else:  # story
        schema_json = """{
  "format": "story",
  "goal": "awareness|engagement|sales|education",
  "title": "judul internal",
  "frames": [
    {"no": 1, "visual": "deskripsi visual frame", "copy": "teks di frame", "sticker_suggestion": "poll|quiz|question|countdown|link|none"},
    "... 3-7 frames total"
  ],
  "cta": "...",
  "exec_notes": "catatan eksekusi (frame transition, music, link sticker target)"
}"""
        return f"""Buat BRIEF EKSEKUSI lengkap untuk STORY Instagram (3-7 frame):

{common_input}

ATURAN OUTPUT:
- Tiap frame ada sticker suggestion (interaktif: poll/quiz/question) — manfaatin engagement story
- Sequence: hook → value → CTA
- Copy frame singkat (story = mobile, attention pendek)

Output JSON valid:
{schema_json}"""


def generate_brief(
    brand_id: str | None,
    format_type: Literal["reel", "carousel_foto", "single_foto", "story"],
    topic: str,
    mode: Literal["tiru", "modifikasi", "original"] = "original",
    angle: str | None = None,
    reference_ids: list[str] | None = None,
    reference_text: str | None = None,
    pillar: str | None = None,
    goal: str | None = None,
    chosen_title: str | None = None,
    scene_count: int | None = None,
) -> dict:
    """Generate brief eksekusi lengkap untuk 1 post.

    brand_id None = free mode: targeted refs (per-brand library) di-skip,
    user wajib pakai reference_text manual kalau mau mode tiru/modifikasi.

    chosen_title (opsional): kalau ada, dipakai sebagai brief.title final +
    bias seluruh hook/scene/caption agar nyambung judul itu. Kalau None,
    LLM bikin judul sendiri (default behavior).

    scene_count (opsional, REEL only): paksa exactly N scenes. Range valid 3-10.
    Kalau None default 5-8 (range bebas LLM).

    Returns format-specific dict (lihat _brief_user_prompt schemas).
    """
    # Compact mode untuk 8b TPM 6000 — trim expertise/profile/social biar muat.
    # Saat 70b TPD reset, ganti compact=False + STUDIO_MODEL → PLAN_MODEL.
    system = _system_prompt(brand_id, BRIEF_ROLE, compact=True)
    # Reference library per-brand → skip kalau free mode
    targeted_refs = (
        _load_specific_references(brand_id, reference_ids) if brand_id else ""
    )

    user = _brief_user_prompt(
        format_type=format_type,
        mode=mode,
        topic=topic,
        angle=angle,
        pillar=pillar,
        goal=goal,
        reference_text=reference_text,
        targeted_refs_block=targeted_refs,
        chosen_title=chosen_title,
        scene_count=scene_count,
    )

    # Brief lebih kompleks (multi-section reasoning + integrate sources)
    # TEMP: pindah ke 8b sementara karena 70b TPD limit hit. max_tokens
    # diturunkan dari 4500 → 2500 + system prompt compact mode → fit di TPM 6000.
    # Quality multi-section turun sedikit tapi acceptable utk free tier.
    # Revert ke PLAN_MODEL + max_tokens 4500 + compact=False saat 70b lega.
    return _generate_json(
        system,
        user,
        max_tokens=2500,
        model=STUDIO_MODEL,
        temperature=0.75,
    )


# ========== 5b. Title generator (step 1 of 2-step Brief workflow) ==========

TITLE_ROLE = """Kamu adalah HELIX Title Director — ahli bikin judul/concept anchor
untuk post sosmed. Judul yang lo bikin bukan caption hook — ini "anchor konsep"
yang nge-capture esensi post dalam 1 kalimat ringkas, jadi bisa dipakai content
team buat align hook, scene, caption, visual ke arah yang sama.

PRINSIP:
- Judul MAX 12 kata, ringkas tapi specific
- Setiap judul punya angle/sudut pandang BERBEDA — jangan 5 variasi yang mirip
- Variasi tipe hook angle: question / contrarian / promise / story / shock / how-to /
  behind-the-scenes / data-driven / personal / list
- Judul harus brand-fit (cek DATA BRAND di system prompt) — bukan generik
- Reasoning tiap judul = 1 kalimat, jelaskan kenapa angle ini effective untuk
  topik+brand ini, bukan deskripsi judulnya"""


def generate_titles(
    brand_id: str | None,
    format_type: Literal["reel", "carousel_foto", "single_foto", "story"],
    topic: str,
    mode: Literal["tiru", "modifikasi", "original"] = "original",
    angle: str | None = None,
    reference_ids: list[str] | None = None,
    reference_text: str | None = None,
    pillar: str | None = None,
    goal: str | None = None,
    count: int = 5,
) -> dict:
    """Generate N rekomendasi judul/concept anchor untuk brief.

    Returns:
        {"titles": [{"text": str, "hook_angle": str, "reasoning": str}, ...]}
    """
    count = max(3, min(int(count), 7))
    system = _system_prompt(brand_id, TITLE_ROLE)
    targeted_refs = (
        _load_specific_references(brand_id, reference_ids) if brand_id else ""
    )

    angle_block = f"\nCUSTOM ANGLE: {angle}" if angle else ""
    pillar_block = f"\nPILLAR: {pillar}" if pillar else ""
    goal_block = f"\nGOAL: {goal}" if goal else ""
    ref_text_block = (
        f"\n\n=== REFERENSI MANUAL (deskripsi user) ===\n{reference_text}"
        if reference_text
        else ""
    )
    mode_guide = {
        "tiru": "ambil pattern judul dari REFERENSI TARGET, ganti substansi brand-fit",
        "modifikasi": "modifikasi referensi pattern, belokin sesuai angle custom",
        "original": "fresh dari brand DNA + topik",
    }
    mode_text = mode_guide.get(mode, mode_guide["original"])

    user = f"""Buat {count} rekomendasi JUDUL/concept anchor untuk post {format_type.upper()}:

TOPIK: {topic}
MODE: {mode} — {mode_text}{angle_block}{pillar_block}{goal_block}{ref_text_block}{targeted_refs}

Aturan output:
- Tepat {count} judul, masing-masing dengan ANGLE BERBEDA (jangan mirip-mirip)
- Setiap judul max 12 kata, hook-able tapi gak tabloid clickbait
- hook_angle = label tipe angle: question | contrarian | promise | story | shock | how-to | behind-the-scenes | data-driven | personal | list
- reasoning 1 kalimat: kenapa angle ini cocok untuk topik+brand ini

Output JSON valid:
{{
  "titles": [
    {{
      "text": "judul ringkas (max 12 kata)",
      "hook_angle": "tipe angle",
      "reasoning": "kenapa angle ini effective untuk topik+brand ini"
    }}
  ]
}}"""

    # Titles = simple list generation, 8b cukup. Hemat TPD 70b buat Brief penuh.
    return _generate_json(
        system,
        user,
        max_tokens=1800,
        model=STUDIO_MODEL,
        temperature=0.85,
    )


# ========== 5c. Single-scene regen (REEL only — fine-tune workflow) ==========

SCENE_REGEN_ROLE = """Kamu adalah HELIX Scene Doctor — ahli regen 1 scene specific
dalam reel/video pendek tanpa ngerusak continuity scene-scene lain.

PRINSIP:
- Output cuma SATU scene baru (bukan array)
- Scene baru harus NYAMBUNG dengan scenes sebelum & sesudahnya (cek context yang dikasih)
- Pertahankan no scene + duration_s sama dengan scene yang di-regen (kecuali user kasih hint beda)
- Kalau ada hint dari user, tafsirin sebagai DIRECTION TWEAK (e.g. "lebih dramatic" =
  pacing tegang, visual kontras tinggi, VO punch — bukan ganti substansi total)
- Jaga konsistensi tone, voice, brand DNA yang ada di scene lain"""


def regen_one_scene(
    brand_id: str | None,
    title: str,
    topic: str,
    scenes_so_far: list[dict],
    scene_no: int,
    hint: str | None = None,
    angle: str | None = None,
    pillar: str | None = None,
    goal: str | None = None,
) -> dict:
    """Regenerate 1 scene dari brief reel yang sudah ada.

    scenes_so_far = full scenes array dari brief existing (untuk continuity context).
    scene_no = nomor scene yang mau di-regen (1-indexed).
    hint = optional direction tweak ("lebih dramatic", "tambah humor", dst).

    Returns:
        {"scene": {"no": int, "duration_s": int, "visual": str, "voiceover": str, "on_screen_text": str}}
    """
    system = _system_prompt(brand_id, SCENE_REGEN_ROLE)

    # Find target + neighboring scenes
    target = next(
        (s for s in scenes_so_far if int(s.get("no", 0)) == int(scene_no)),
        None,
    )
    if not target:
        raise ValueError(f"Scene #{scene_no} tidak ditemukan di scenes_so_far")

    other_scenes_text = "\n".join(
        f"  Scene {s.get('no')}: {s.get('visual', '')} | VO: {s.get('voiceover', '')} | OST: {s.get('on_screen_text', '')}"
        for s in scenes_so_far
        if int(s.get("no", 0)) != int(scene_no)
    )
    target_text = (
        f"  Scene {target.get('no')}: {target.get('visual', '')} | VO: {target.get('voiceover', '')} | OST: {target.get('on_screen_text', '')}"
    )

    angle_block = f"\nCUSTOM ANGLE: {angle}" if angle else ""
    pillar_block = f"\nPILLAR: {pillar}" if pillar else ""
    goal_block = f"\nGOAL: {goal}" if goal else ""
    hint_block = (
        f"""

=== HINT REGEN DARI USER ===
"{hint}"

Pakai hint ini sebagai direction tweak. Jangan ganti substansi total — adjust pacing/tone/visual sesuai hint."""
        if hint and hint.strip()
        else ""
    )

    user = f"""Regen 1 scene specific dari reel berikut.

JUDUL: {title}
TOPIK: {topic}{angle_block}{pillar_block}{goal_block}

=== SCENES YANG SUDAH ADA (jangan diubah, untuk context continuity) ===
{other_scenes_text}

=== SCENE YANG DI-REGEN (Scene #{scene_no}) ===
{target_text}{hint_block}

Aturan:
- Output 1 scene SAJA, bukan array
- `no` WAJIB sama: {scene_no}
- `duration_s` boleh sama atau adjust 1-2 detik kalau perlu (max 8s per scene)
- Scene baru harus connect smooth ke scene sebelumnya & sesudahnya
- Beda dari versi lama (jangan rewrite hampir sama persis), tapi tetep tone konsisten

Output JSON valid:
{{
  "scene": {{
    "no": {scene_no},
    "duration_s": 3,
    "visual": "deskripsi shot konkret",
    "voiceover": "VO/narasi (kosong kalau silent)",
    "on_screen_text": "teks layar"
  }}
}}"""

    # Single scene regen = scoped task, 8b cukup. Hemat TPD 70b.
    return _generate_json(
        system,
        user,
        max_tokens=600,
        model=STUDIO_MODEL,
        temperature=0.8,
    )
