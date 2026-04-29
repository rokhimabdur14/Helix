"""
HELIX — CSV Adapter
Detect format raw export (Instagram / TikTok / HELIX) → map ke schema HELIX.

Tujuan: user bisa upload CSV langsung dari Meta Business Suite atau TikTok
Creator Center tanpa convert manual. Adapter normalisasi header + cell values
ke schema HELIX, lalu insights_parser yang existing kerja seperti biasa.
"""

import csv
import io
import re
from datetime import datetime
from typing import Literal

# Output schema HELIX (tetap, harus match insights_parser + REQUIRED_INSIGHT_COLUMNS)
HELIX_HEADER = [
    "post_id", "date", "posted_time", "type", "content_pillar",
    "caption", "hashtags",
    "reach", "impressions", "likes", "comments",
    "saves", "shares", "profile_visits", "follows",
]

# Signature: kalau ada salah satu kolom ini, kemungkinan besar format itu
IG_SIGNATURES = {
    "permalink", "publish time", "post type", "media type",
    "accounts reached", "ig post id",
}
TIKTOK_SIGNATURES = {
    "video views", "video link", "video title", "date posted",
    "time posted", "total views",
}

# Header alias map per format. Kunci = HELIX field, value = list nama kolom
# yang mungkin di source export (lowercased, stripped). Match pertama menang.
IG_ALIASES = {
    "post_id": ["post id", "ig post id", "id", "media id", "permalink"],
    "date": ["publish time", "date", "publish_time", "post created"],
    "posted_time": ["time", "posted time"],
    "type": ["post type", "media type", "type"],
    "caption": ["description", "caption", "post caption", "title"],
    "reach": ["reach", "accounts reached"],
    "impressions": ["impressions", "views", "plays"],
    "likes": ["likes", "like count"],
    "comments": ["comments", "comment count"],
    "saves": ["saves", "saved"],
    "shares": ["shares", "share count"],
    "profile_visits": ["profile visits", "profile activity"],
    "follows": ["follows", "follow count", "new followers"],
}

TIKTOK_ALIASES = {
    "post_id": ["video link", "video id", "post id"],
    "date": ["date posted", "date", "publish date"],
    "posted_time": ["time posted", "time"],
    "type": [],  # TT default = reel
    "caption": ["video title", "title", "description", "caption"],
    "reach": ["reach"],  # TT analytics jarang expose reach — fallback ke views
    "impressions": ["video views", "total views", "views", "impressions"],
    "likes": ["total likes", "likes", "like count"],
    "comments": ["total comments", "comments"],
    "saves": ["saves", "saved", "total saves"],
    "shares": ["total shares", "shares", "share count"],
    "profile_visits": ["profile visits"],
    "follows": ["new followers", "follows", "follower growth"],
}

# Map raw type values → HELIX type vocabulary (image | reel | carousel | story)
_TYPE_NORMALIZER = {
    "ig image": "image",
    "ig video": "reel",
    "ig reels": "reel",
    "ig reel": "reel",
    "ig carousel": "carousel",
    "ig carousel album": "carousel",
    "carousel album": "carousel",
    "carousel_album": "carousel",
    "image": "image",
    "photo": "image",
    "video": "reel",
    "reel": "reel",
    "reels": "reel",
    "carousel": "carousel",
    "story": "story",
}

_HASHTAG_RE = re.compile(r"#\w+")


def detect_format(
    fieldnames: list[str] | None,
) -> Literal["helix", "instagram", "tiktok", "unknown"]:
    """Tebak format CSV dari header columns."""
    if not fieldnames:
        return "unknown"
    norm = {(h or "").strip().lower() for h in fieldnames}

    # HELIX: snake_case + post_id WAJIB ada
    helix_required = {"post_id", "reach", "likes"}
    if helix_required.issubset(norm):
        return "helix"

    # TikTok signatures lebih spesifik dari IG (video views unik) — cek dulu
    if norm & TIKTOK_SIGNATURES:
        return "tiktok"

    if norm & IG_SIGNATURES:
        return "instagram"

    return "unknown"


def _find_value(row: dict, candidates: list[str]) -> str:
    """Cari nilai pertama yang non-empty dari row matching salah satu candidate column."""
    norm_row = {(k or "").strip().lower(): (v or "") for k, v in row.items()}
    for c in candidates:
        v = norm_row.get(c.strip().lower(), "")
        s = str(v).strip()
        if s:
            return s
    return ""


def _split_caption_hashtags(text: str) -> tuple[str, str]:
    """Pisahkan caption text dari hashtag. Return (caption_clean, hashtags_string)."""
    if not text:
        return "", ""
    tags = _HASHTAG_RE.findall(text)
    cleaned = _HASHTAG_RE.sub("", text).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned, " ".join(tags)


# (format, has_time) — has_time False berarti format date-only, jangan pakai time-nya
_DATE_FORMATS: list[tuple[str, bool]] = [
    ("%Y-%m-%dT%H:%M:%S%z", True),
    ("%Y-%m-%dT%H:%M:%S", True),
    ("%Y-%m-%d %H:%M:%S", True),
    ("%Y-%m-%d %H:%M", True),
    ("%Y/%m/%d %H:%M:%S", True),
    ("%Y/%m/%d %H:%M", True),
    ("%m/%d/%Y %H:%M:%S", True),
    ("%m/%d/%Y %H:%M", True),
    ("%d/%m/%Y %H:%M", True),
    ("%Y-%m-%d", False),
    ("%Y/%m/%d", False),
    ("%m/%d/%Y", False),
    ("%d/%m/%Y", False),
]


def _parse_datetime(raw: str) -> tuple[str, str]:
    """Parse berbagai format date → (YYYY-MM-DD, HH:MM atau '' kalau format date-only)."""
    if not raw:
        return "", ""
    raw = raw.strip()
    for fmt, has_time in _DATE_FORMATS:
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.strftime("%Y-%m-%d"), (dt.strftime("%H:%M") if has_time else "")
        except ValueError:
            continue
    # Last resort: ambil 10 char pertama kalau looks like ISO date
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", raw)
    if m:
        return m.group(1), ""
    return "", ""


def _parse_time_only(raw: str) -> str:
    if not raw:
        return ""
    raw = raw.strip()
    for fmt in ("%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M:%S %p"):
        try:
            return datetime.strptime(raw, fmt).strftime("%H:%M")
        except ValueError:
            continue
    return ""


def _normalize_type(raw: str, default: str) -> str:
    if not raw:
        return default
    s = raw.strip().lower()
    if s in _TYPE_NORMALIZER:
        return _TYPE_NORMALIZER[s]
    # substring match — IG kadang format "IG REELS" atau "Reels (Video)"
    for key, val in _TYPE_NORMALIZER.items():
        if key in s:
            return val
    return default


def _clean_int_str(raw: str) -> str:
    """Buang koma ribuan / spasi dari angka. '1,234' → '1234'."""
    if not raw:
        return "0"
    cleaned = re.sub(r"[,\s]", "", str(raw).strip())
    if not cleaned or cleaned == "-":
        return "0"
    # Buang trailing decimal kalau ada (TT kadang export float)
    if "." in cleaned:
        cleaned = cleaned.split(".", 1)[0]
    return cleaned if cleaned.lstrip("-").isdigit() else "0"


def adapt_rows(
    rows: list[dict],
    src_format: str,
) -> tuple[list[dict], dict]:
    """Map rows from source format → HELIX schema rows.

    Args:
        rows: list of dict dari csv.DictReader
        src_format: "helix" | "instagram" | "tiktok"

    Returns:
        (helix_rows, report) — report = dict info jumlah row + format
    """
    if src_format == "helix":
        return rows, {
            "format_detected": "helix",
            "rows_in": len(rows),
            "rows_out": len(rows),
            "adapted": False,
        }

    aliases = IG_ALIASES if src_format == "instagram" else TIKTOK_ALIASES
    # TikTok = vertical short-form video by default
    default_type = "reel" if src_format == "tiktok" else "image"

    out: list[dict] = []
    for idx, row in enumerate(rows, start=1):
        helix_row: dict[str, str] = {}

        # post_id — fallback ke generated kalau source gak punya
        post_id_val = _find_value(row, aliases.get("post_id", []))
        helix_row["post_id"] = post_id_val or f"{src_format}_{idx:03d}"

        # date + posted_time — IG sering combined "publish time" ISO 8601
        date_raw = _find_value(row, aliases.get("date", []))
        time_raw = _find_value(row, aliases.get("posted_time", []))
        date_str, time_str = _parse_datetime(date_raw)
        if not time_str:
            time_str = _parse_time_only(time_raw)
        helix_row["date"] = date_str
        helix_row["posted_time"] = time_str or "00:00"

        helix_row["type"] = _normalize_type(
            _find_value(row, aliases.get("type", [])),
            default_type,
        )

        # Caption + extract hashtags
        caption_raw = _find_value(row, aliases.get("caption", []))
        caption, hashtags = _split_caption_hashtags(caption_raw)
        helix_row["caption"] = caption
        helix_row["hashtags"] = hashtags

        # Numeric fields
        for f in ("reach", "impressions", "likes", "comments",
                  "saves", "shares", "profile_visits", "follows"):
            helix_row[f] = _clean_int_str(_find_value(row, aliases.get(f, [])))

        # TikTok analytics gak expose reach — fallback ke impressions/views
        if src_format == "tiktok" and helix_row["reach"] in ("0", ""):
            helix_row["reach"] = helix_row["impressions"]

        # content_pillar kosong, akan diisi LLM classifier kalau brand punya pillars
        helix_row["content_pillar"] = ""

        out.append(helix_row)

    return out, {
        "format_detected": src_format,
        "rows_in": len(rows),
        "rows_out": len(out),
        "adapted": True,
    }


def rows_to_csv(rows: list[dict], header: list[str] = HELIX_HEADER) -> str:
    """Serialize rows → CSV string dengan HELIX header order. Skip kolom extra."""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=header, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow({k: r.get(k, "") for k in header})
    return buf.getvalue()


def parse_csv_text(text: str) -> tuple[list[dict], list[str]]:
    """Parse CSV text → (rows, fieldnames). Convenience wrapper."""
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = list(reader.fieldnames or [])
    rows = list(reader)
    return rows, fieldnames
