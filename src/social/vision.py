"""Groq vision client + analysis prompts untuk profile snapshot + post URL.

Pakai Llama 4 Scout (multimodal) di Groq free tier. Return structured JSON.
"""

import json
from typing import Literal

from src.ai.brain import client

# Llama 4 Scout — multimodal, support image input via OpenAI-compatible format.
# Kalau model ini deprecated/down, fallback ke maverick.
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
VISION_FALLBACK = "meta-llama/llama-4-maverick-17b-128e-instruct"

Platform = Literal["instagram", "tiktok"]


def _call_vision(
    prompt: str,
    image_data_url: str,
    max_tokens: int = 2000,
    temperature: float = 0.4,
) -> dict:
    """Kirim prompt + image ke Groq vision, parse JSON response.

    Try VISION_MODEL dulu, fallback ke VISION_FALLBACK kalau error.
    """
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
    for model in (VISION_MODEL, VISION_FALLBACK):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(f"Vision call gagal di semua model: {last_err}")


PROFILE_PROMPT = """Kamu adalah HELIX Brand Aesthetic Analyst.

Screenshot di atas adalah halaman profile sosial media (Instagram atau TikTok).
Analisa visual + textual yang terlihat. Output WAJIB valid JSON sesuai schema
di bawah, bahasa Indonesia kasual-profesional.

Kalau ada element yang gak terlihat / gak bisa di-determine, isi dengan
"tidak terlihat" atau array kosong. JANGAN ngarang.

JSON schema:
{
  "platform": "instagram|tiktok|tidak terlihat",
  "handle": "username yang terlihat di profile (tanpa @)",
  "display_name": "nama display yang muncul",
  "bio": "bio text persis seperti di profile",
  "stats": {
    "posts": "angka posts atau 'tidak terlihat'",
    "followers": "angka followers atau 'tidak terlihat'",
    "following": "angka following atau 'tidak terlihat'"
  },
  "highlights": ["nama highlight 1", "highlight 2"],
  "color_palette": ["#HEX1", "#HEX2", "#HEX3"],
  "vibe": "1-2 kalimat tentang vibe overall (ex: 'clean minimalist warm tones', 'moody cinematic editorial', 'vibrant playful saturated')",
  "content_themes": [
    {"theme": "nama tema", "estimated_share_pct": 50}
  ],
  "format_mix": {
    "single_image_pct": 0,
    "carousel_pct": 0,
    "reel_or_video_pct": 0
  },
  "editing_style": "Deskripsi editing pattern: filter, overlay, font, layout signature",
  "consistency_score": "high|medium|low",
  "consistency_reason": "1 kalimat alasan",
  "key_observations": [
    "observasi konkret 1",
    "observasi konkret 2",
    "observasi konkret 3"
  ],
  "recommended_replication_pillars": [
    "pillar 1 yang HELIX bisa pakai untuk generate konten serupa",
    "pillar 2"
  ]
}"""


REFERENCE_PROMPT = """Kamu adalah HELIX Reference Pattern Analyst.

Screenshot di atas adalah satu post di Instagram atau TikTok. Pengguna pilih
post ini sebagai REFERENSI untuk inspirasi konten brand mereka. Tugas kamu:
ekstrak pattern yang bisa diconceptual-replicate.

Output WAJIB valid JSON sesuai schema, bahasa Indonesia kasual-profesional.
Kalau ada element gak terlihat, isi "tidak terlihat" atau array kosong.

JSON schema:
{
  "platform": "instagram|tiktok|tidak terlihat",
  "format": "reel|carousel|single_image|video|story|tidak terlihat",
  "creator_handle": "username creator post (tanpa @, kalau terlihat)",
  "visual_summary": "1-2 kalimat deskripsi visual (subject, composition, color, lighting)",
  "hook_or_first_frame": "Apa yang viewer lihat di detik pertama / slide pertama. Quote text overlay kalau ada.",
  "caption_excerpt": "Caption yang terlihat (mungkin truncated). Kalau gak ada, '-'",
  "caption_style": "1 kalimat: tone, panjang, struktur (mis. 'short punchy with question', 'storytelling 3 paragraph')",
  "hooks_pattern": "Tipe hook: question / shock / promise / contrarian / story / listicle / how-to / behind-the-scenes / dst",
  "topic_or_pillar": "Tema/pillar konten ini (mis. 'tutorial', 'product showcase', 'BTS', 'testimonial')",
  "engagement_signals": {
    "likes": "angka kalau terlihat atau 'tidak terlihat'",
    "comments": "angka atau 'tidak terlihat'",
    "views": "angka atau 'tidak terlihat'"
  },
  "why_it_works": [
    "alasan 1 kenapa post ini bisa perform (visual hook, scarcity, relatability, dst)",
    "alasan 2",
    "alasan 3"
  ],
  "replication_angle": "Saran konkret bagaimana brand bisa adapt pattern ini untuk konten sendiri (1-2 kalimat)",
  "suggested_use_for_brand": "Untuk brand kamu, pattern ini paling cocok dipakai di konten dengan goal: awareness|engagement|sales|education + alasan singkat"
}"""


def analyze_profile(image_data_url: str) -> dict:
    """Run vision analysis untuk profile screenshot."""
    return _call_vision(PROFILE_PROMPT, image_data_url, max_tokens=2000)


def analyze_reference(image_data_url: str) -> dict:
    """Run vision analysis untuk single post screenshot."""
    return _call_vision(REFERENCE_PROMPT, image_data_url, max_tokens=2000)
