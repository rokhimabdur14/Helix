"""
HELIX — Screenshot Insights Extractor
Ekstrak metric per-post dari screenshot Instagram Reels Insights pakai
Llama 4 Scout (vision LLM, Groq free tier).

User workflow: buka post Insights di app IG mobile → screenshot → upload.
Vision LLM baca angka + label → return HELIX schema row + confidence flag.

Sister module: src/social/vision.py (profile + reference snapshot).
Pakai vision client yang sama tapi prompt khusus Insights panel.
"""

import base64
import json
import re
from datetime import datetime
from typing import Literal

from src.ai.brain import client

# Same model lineup with src/social/vision.py — multimodal Llama 4 di Groq.
# Maverick fallback deprecated by Groq per 2026-05-11; sekarang Scout only
# dengan retry-on-flake (3x exponential backoff).
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
VISION_MAX_RETRIES = 3


def image_bytes_to_data_url(data: bytes, mime: str = "image/png") -> str:
    """Encode raw image bytes ke data URL untuk Groq vision input."""
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


EXTRACT_PROMPT = """Kamu adalah HELIX Insights Extractor.

Screenshot di atas adalah panel "Insights" / "Statistik" dari satu post di
Instagram (biasanya Reel) atau TikTok. Tugas kamu: ekstrak angka metric +
metadata post jadi JSON terstruktur.

ATURAN KETAT:
- HANYA isi field dengan angka/teks yang BENAR-BENAR TERLIHAT di screenshot.
- Kalau angka punya suffix "K"/"rb" (ribu) atau "M"/"jt" (juta), convert ke
  angka full. Contoh: "1.2K" → 1200, "15rb" → 15000, "2.3M" → 2300000.
- Kalau ada koma desimal ("1,2K"), perlakukan sebagai pemisah desimal IDN
  (1.2K → 1200). Kalau koma sebagai pemisah ribuan ("12,345"), drop koma
  → 12345.
- Kalau field tidak terlihat / tidak ada di screenshot, isi 0 untuk angka,
  "" untuk teks, dan tambah ke `not_visible` list.
- JANGAN MENGARANG. Lebih baik 0 + masuk not_visible daripada nebak.
- "Plays" / "Views" / "Tayangan" = impressions. "Accounts reached" /
  "Reach" / "Akun terjangkau" = reach. Kalau cuma satu yang terlihat, isi
  field-nya dan biarkan yang lain 0.
- "Follows from this post" / "Pengikut dari post ini" = follows. JANGAN
  bingung dengan total followers akun.
- Type post: default "reel" kalau Insights menunjukkan "Plays/Tayangan"
  metric. "carousel" kalau ada indikator multi-slide. "image" untuk foto
  tunggal. "story" kalau Insights bilang "Story".

JSON schema (semua field WAJIB ada):
{
  "platform": "instagram | tiktok | tidak terlihat",
  "type": "reel | carousel | image | story",
  "date": "YYYY-MM-DD atau '' kalau tidak terlihat",
  "posted_time": "HH:MM 24-jam atau '' kalau tidak terlihat",
  "caption_preview": "Caption yang terlihat di screenshot (mungkin truncated). Kalau gak ada, ''",
  "metrics": {
    "reach": 0,
    "impressions": 0,
    "likes": 0,
    "comments": 0,
    "saves": 0,
    "shares": 0,
    "profile_visits": 0,
    "follows": 0
  },
  "not_visible": ["nama_field_yang_tidak_terlihat", "..."],
  "confidence": "high | medium | low",
  "confidence_reason": "1 kalimat: kenapa confidence ini (mis. 'angka jelas, semua metric core terlihat' atau 'screenshot blur di bagian bawah')"
}"""


def _call_vision(
    prompt: str,
    image_data_url: str,
    max_tokens: int = 1200,
    temperature: float = 0.2,
) -> dict:
    """Kirim prompt + image ke Groq vision, parse JSON response.

    Retry Scout sampai VISION_MAX_RETRIES x dengan exponential backoff
    (1s/2s). Temperature rendah (0.2) untuk extraction — lebih konsisten,
    less hallucination.
    """
    import time

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": image_data_url}},
            ],
        }
    ]

    last_err = None
    for attempt in range(VISION_MAX_RETRIES):
        try:
            resp = client.chat.completions.create(
                model=VISION_MODEL,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            last_err = e
            if attempt < VISION_MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
            continue
    raise RuntimeError(
        f"Vision extraction gagal setelah {VISION_MAX_RETRIES} retries: {last_err}"
    )


_HASHTAG_RE = re.compile(r"#\w+")


def _split_caption_hashtags(text: str) -> tuple[str, str]:
    """Pisahkan caption text dari hashtag. Same logic as csv_adapter."""
    if not text:
        return "", ""
    tags = _HASHTAG_RE.findall(text)
    cleaned = _HASHTAG_RE.sub("", text).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned, " ".join(tags)


def _safe_int(val) -> int:
    """Coerce vision LLM output ke int. LLM kadang return string."""
    if isinstance(val, int):
        return max(0, val)
    if isinstance(val, float):
        return max(0, int(val))
    if isinstance(val, str):
        s = re.sub(r"[,\s]", "", val.strip())
        if not s or s == "-":
            return 0
        try:
            return max(0, int(float(s)))
        except ValueError:
            return 0
    return 0


_TYPE_VOCAB = {"reel", "carousel", "image", "story"}


def extract(
    image_bytes: bytes,
    mime: str = "image/png",
    fallback_post_id: str | None = None,
    user_caption: str | None = None,
) -> dict:
    """Ekstrak HELIX-schema insights row dari screenshot Insights bytes.

    Args:
        image_bytes: raw bytes screenshot (PNG/JPEG)
        mime: MIME type (default png)
        fallback_post_id: kalau LLM gak bisa derive post_id (biasanya iya, krn
            screenshot gak expose IG post id), pakai ini. Default = auto-gen
            dari timestamp.
        user_caption: kalau user paste caption manual via UI (lebih akurat
            daripada caption_preview yang LLM crop dari screenshot), pakai ini.

    Returns:
        dict dengan key:
          - row: HELIX schema dict (siap append ke CSV)
          - raw: raw output vision LLM (untuk debug + diagnosis input)
          - confidence: "high" | "medium" | "low"
          - confidence_reason: str
          - not_visible: list[str]
    """
    data_url = image_bytes_to_data_url(image_bytes, mime=mime)
    raw = _call_vision(EXTRACT_PROMPT, data_url)

    metrics = raw.get("metrics") or {}
    reach = _safe_int(metrics.get("reach"))
    impressions = _safe_int(metrics.get("impressions"))
    # TT analytics gak expose reach — fallback ke impressions kalau cuma satu yang ada
    if reach == 0 and impressions > 0:
        reach = impressions
    if impressions == 0 and reach > 0:
        impressions = reach

    # Post type — validate masuk vocab HELIX
    raw_type = str(raw.get("type") or "reel").strip().lower()
    post_type = raw_type if raw_type in _TYPE_VOCAB else "reel"

    # Caption: prefer user-provided, fallback ke vision-extracted preview
    caption_src = (user_caption or raw.get("caption_preview") or "").strip()
    caption_clean, hashtags = _split_caption_hashtags(caption_src)

    # Date: validate format, fallback "" (parser downstream handle)
    date_str = str(raw.get("date") or "").strip()
    if date_str and not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        date_str = ""

    posted_time = str(raw.get("posted_time") or "").strip()
    if posted_time and not re.match(r"^\d{2}:\d{2}$", posted_time):
        posted_time = ""

    # post_id: gak terlihat di screenshot Insights — generate dari timestamp +
    # fallback param. Format: scr_<YYMMDDHHMMSS> biar unik & sortable.
    if fallback_post_id:
        post_id = fallback_post_id
    else:
        post_id = "scr_" + datetime.now().strftime("%y%m%d%H%M%S")

    row = {
        "post_id": post_id,
        "date": date_str,
        "posted_time": posted_time or "00:00",
        "type": post_type,
        "content_pillar": "",  # diisi LLM classifier downstream
        "caption": caption_clean,
        "hashtags": hashtags,
        "reach": str(reach),
        "impressions": str(impressions),
        "likes": str(_safe_int(metrics.get("likes"))),
        "comments": str(_safe_int(metrics.get("comments"))),
        "saves": str(_safe_int(metrics.get("saves"))),
        "shares": str(_safe_int(metrics.get("shares"))),
        "profile_visits": str(_safe_int(metrics.get("profile_visits"))),
        "follows": str(_safe_int(metrics.get("follows"))),
    }

    confidence = str(raw.get("confidence") or "medium").strip().lower()
    if confidence not in ("high", "medium", "low"):
        confidence = "medium"

    # Auto-downgrade kalau core metric (reach + likes) dua-duanya 0
    if reach == 0 and _safe_int(metrics.get("likes")) == 0:
        confidence = "low"

    return {
        "row": row,
        "raw": raw,
        "confidence": confidence,
        "confidence_reason": str(raw.get("confidence_reason") or ""),
        "not_visible": list(raw.get("not_visible") or []),
        "platform": str(raw.get("platform") or "tidak terlihat"),
    }
