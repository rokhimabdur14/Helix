"""Playwright screenshot capture untuk profile + post URL Instagram/TikTok.

Pakai mobile viewport + mobile UA biar dapet layout grid yang clean dan
mengurangi kemungkinan login wall trigger di IG.
"""

import base64
import re
from io import BytesIO
from typing import Literal


# Mobile UA + viewport — IG kasih layout grid yang lebih clean dibanding desktop,
# dan login wall lebih jarang muncul (terutama untuk view-only).
MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)
MOBILE_VIEWPORT = {"width": 412, "height": 915}  # Pixel 7-ish

Platform = Literal["instagram", "tiktok"]


def detect_platform(url: str) -> Platform | None:
    """Detect platform from URL."""
    if "instagram.com" in url:
        return "instagram"
    if "tiktok.com" in url:
        return "tiktok"
    return None


def normalize_handle(handle: str) -> str:
    """Strip @ prefix and trim whitespace."""
    return handle.strip().lstrip("@")


def profile_url(platform: Platform, handle: str) -> str:
    """Build profile URL from handle."""
    h = normalize_handle(handle)
    if platform == "instagram":
        return f"https://www.instagram.com/{h}/"
    return f"https://www.tiktok.com/@{h}"


def capture(url: str, full_page: bool = False, max_height: int = 2400) -> bytes:
    """Take screenshot of URL, return PNG bytes.

    Args:
        url: target page
        full_page: True = capture entire scrollable page; False = viewport only
        max_height: kalau full_page, cap height supaya screenshot gak kebesaran
            (vision LLM ada limit ukuran input)

    Raises:
        RuntimeError jika Playwright gagal init atau page gagal load
    """
    # Lazy import — Playwright heavy
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(
                user_agent=MOBILE_UA,
                viewport=MOBILE_VIEWPORT,
                device_scale_factor=2,
                is_mobile=True,
                has_touch=True,
                locale="id-ID",
            )
            page = context.new_page()
            try:
                # domcontentloaded biar gak nunggu network idle (IG/TT analytics
                # bikin networkidle hampir gak pernah trigger)
                page.goto(url, timeout=20000, wait_until="domcontentloaded")
                # Beri 2 detik biar grid render + lazy images muat sebagian
                page.wait_for_timeout(2500)
                # Dismiss IG cookie banner kalau ada
                _try_dismiss_ig_overlays(page)

                if full_page:
                    # Cap height supaya output PNG gak kegedean
                    clip = {
                        "x": 0,
                        "y": 0,
                        "width": MOBILE_VIEWPORT["width"],
                        "height": max_height,
                    }
                    return page.screenshot(clip=clip, type="png")
                return page.screenshot(type="png")
            finally:
                page.close()
                context.close()
        finally:
            browser.close()


def _try_dismiss_ig_overlays(page) -> None:
    """Best-effort dismiss IG login modal / cookie banner. Silent on failure."""
    selectors = [
        # Cookie banner
        'button:has-text("Allow all cookies")',
        'button:has-text("Accept All")',
        'button:has-text("Izinkan semua")',
        # Login modal close — IG sering munculin "Log in" sheet, ada X button
        'div[role="dialog"] svg[aria-label="Close"]',
        'div[role="presentation"] button[aria-label="Close"]',
    ]
    for sel in selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=500):
                el.click(timeout=1000)
                page.wait_for_timeout(300)
        except Exception:
            continue


def to_data_url(png_bytes: bytes) -> str:
    """Encode PNG bytes ke data URL untuk dikirim ke vision LLM."""
    b64 = base64.b64encode(png_bytes).decode("ascii")
    return f"data:image/png;base64,{b64}"


def thumbnail_data_url(png_bytes: bytes, max_dim: int = 400) -> str:
    """Resize ke thumbnail kecil + encode base64 untuk disimpan di JSON.

    Original screenshot bisa 1-3 MB. Thumbnail 400px ~30-80 KB, cukup untuk
    UI preview dan persist di JSON tanpa bikin file balon.
    """
    try:
        from PIL import Image
    except ImportError:
        # Pillow not available — fallback: return original (large)
        return to_data_url(png_bytes)

    img = Image.open(BytesIO(png_bytes))
    img.thumbnail((max_dim, max_dim))
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=80, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def is_supported_url(url: str) -> bool:
    """Check apakah URL bisa di-screenshot oleh kita.

    Hanya support post/profile IG dan TikTok, hindari ad/sponsored URL etc.
    """
    if not re.match(r"^https?://", url):
        return False
    p = detect_platform(url)
    return p is not None
