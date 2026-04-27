"""Playwright screenshot capture untuk profile + post URL Instagram/TikTok.

Pakai mobile viewport + mobile UA biar dapet layout grid yang clean dan
mengurangi kemungkinan login wall trigger di IG.
"""

import base64
import re
from io import BytesIO
from typing import Literal


# Desktop UA — empirically lebih sering kasih content yang ke-render daripada
# mobile UA. IG mobile aktif redirect ke login sheet; desktop kasih public
# preview (dengan login overlay yang bisa kita dismiss).
DESKTOP_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)
DESKTOP_VIEWPORT = {"width": 1280, "height": 1800}

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
        RuntimeError jika Playwright gagal init / page gagal load / detect
        halaman login wall atau "user not found" (UI kasih error jelas).
    """
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(
                user_agent=DESKTOP_UA,
                viewport=DESKTOP_VIEWPORT,
                locale="id-ID",
                # IG / TT cek kombinasi UA + headers; kasih header yang masuk akal
                extra_http_headers={
                    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
                },
            )
            page = context.new_page()
            try:
                page.goto(url, timeout=20000, wait_until="domcontentloaded")
                _wait_for_content(page, url)
                _try_dismiss_overlays(page)
                # Settle 1 detik tambahan supaya post images lazy-load
                page.wait_for_timeout(1000)

                # Detect halaman error (user gak ada / login wall full screen)
                _detect_dead_page(page, url)

                if full_page:
                    clip = {
                        "x": 0,
                        "y": 0,
                        "width": DESKTOP_VIEWPORT["width"],
                        "height": max_height,
                    }
                    return page.screenshot(clip=clip, type="png")
                return page.screenshot(type="png")
            finally:
                page.close()
                context.close()
        finally:
            browser.close()


def _wait_for_content(page, url: str) -> None:
    """Tunggu sampai indikator content muncul. Kalau timeout, lanjut aja —
    biar _detect_dead_page yang putuskan apakah usable.
    """
    if "instagram.com" in url:
        # IG: tunggu ada gambar profile / post grid
        selectors = ["img[alt]", "main article", "header img"]
    elif "tiktok.com" in url:
        # TT: tunggu post grid atau profile header
        selectors = ['[data-e2e="user-post-item"]', "h1", "header"]
    else:
        return
    for sel in selectors:
        try:
            page.locator(sel).first.wait_for(timeout=4000, state="visible")
            return
        except Exception:
            continue


def _try_dismiss_overlays(page) -> None:
    """Best-effort dismiss login modal / cookie banner. Silent on failure."""
    selectors = [
        # IG cookie banner (desktop)
        'button._a9--._ap36._a9_0',
        'button:has-text("Allow all cookies")',
        'button:has-text("Accept All")',
        'button:has-text("Izinkan semua")',
        # IG "Log in" modal close
        'div[role="dialog"] svg[aria-label="Close"]',
        'div[role="presentation"] button[aria-label="Close"]',
        # TikTok cookie banner / login modal close
        'tiktok-cookie-banner button',
        'div[data-e2e="modal-close-inner-button"]',
    ]
    for sel in selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=500):
                el.click(timeout=1000)
                page.wait_for_timeout(300)
        except Exception:
            continue


def _detect_dead_page(page, url: str) -> None:
    """Raise RuntimeError dengan pesan jelas kalau halaman jelas dead-end.

    Trigger kalau:
    - IG kasih halaman "Sorry, this page isn't available."
    - IG full-screen login wall (no public preview)
    - TikTok kasih "Couldn't find this account"
    """
    try:
        body_text = page.locator("body").inner_text(timeout=2000) or ""
    except Exception:
        body_text = ""
    lower = body_text.lower()

    not_found_markers = (
        "sorry, this page isn't available",
        "page not found",
        "couldn't find this account",
        "the link you followed may be broken",
        "halaman tidak tersedia",
    )
    for marker in not_found_markers:
        if marker in lower:
            raise RuntimeError(
                f"Halaman tidak tersedia / handle tidak ditemukan ({url}). "
                f"Cek username sosmed sudah benar."
            )

    # IG full login wall: body cuma berisi prompt login + minim content
    if "instagram.com" in url:
        login_markers = ("log in to see", "log in to instagram", "create new account")
        login_hits = sum(1 for m in login_markers if m in lower)
        if login_hits >= 2 and len(body_text) < 600:
            raise RuntimeError(
                "Instagram blokir public preview untuk profile ini (login wall). "
                "Coba handle lain, atau IG butuh waktu — retry lagi nanti."
            )


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
