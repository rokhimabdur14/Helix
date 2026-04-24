"""
HELIX — Website Scraper
Scrape brand website dan extract semua teks konten untuk knowledge base AI.

Strategi 2-tier:
- Tier 1: cloudscraper (fast path, handle Cloudflare basic challenges)
- Tier 2: Playwright headless Chromium (fallback untuk SPA yang render di JS)
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

import cloudscraper
from bs4 import BeautifulSoup

# Paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
CONFIG_DIR = PROJECT_ROOT / "config" / "brands"

# Single cloudscraper session, reused across requests
_scraper = cloudscraper.create_scraper(
    browser={"browser": "chrome", "platform": "windows", "mobile": False},
)
_scraper.headers.update({"Accept-Language": "id,en;q=0.9"})

# Lazy-load Playwright (heavy import; only init when needed)
_playwright_ctx = None
_playwright_browser = None


def _get_playwright_browser():
    global _playwright_ctx, _playwright_browser
    if _playwright_browser is None:
        from playwright.sync_api import sync_playwright
        _playwright_ctx = sync_playwright().start()
        _playwright_browser = _playwright_ctx.chromium.launch(headless=True)
    return _playwright_browser


def close_playwright():
    """Call at end of scrape session to release browser."""
    global _playwright_ctx, _playwright_browser
    if _playwright_browser:
        _playwright_browser.close()
        _playwright_browser = None
    if _playwright_ctx:
        _playwright_ctx.stop()
        _playwright_ctx = None


def load_brand_config(brand_id: str) -> dict:
    config_path = CONFIG_DIR / f"{brand_id}.config.json"
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


# Indicators a page is a JS-rendered SPA with minimal pre-rendered HTML
SPA_MARKERS = (
    'id="root"', "id='root'",
    'id="__next"', "id='__next'",
    'id="app"', "id='app'",
    'data-reactroot',
    'ng-version=',  # Angular
    'data-v-app',   # Vue
)


def _looks_like_empty_spa(html: str) -> bool:
    """Detect if this HTML is a JS-heavy SPA with little pre-rendered content."""
    # Extract body text length (rough check)
    soup = BeautifulSoup(html, "lxml")
    body = soup.find("body")
    if not body:
        return True

    # Strip scripts/styles/noscript first
    for tag in body.find_all(["script", "style", "noscript"]):
        tag.decompose()

    text = body.get_text(strip=True)
    has_spa_marker = any(marker in html for marker in SPA_MARKERS)

    # If page has SPA markers AND body text is very sparse → SPA
    return has_spa_marker and len(text) < 300


def fetch_page(url: str, use_playwright: bool = False) -> BeautifulSoup | None:
    """Fetch a page and return BeautifulSoup.

    Tries cloudscraper first (fast). Falls back to Playwright if:
    - use_playwright=True (forced)
    - page looks like empty SPA
    """
    if not use_playwright:
        # Tier 1: cloudscraper
        try:
            resp = _scraper.get(url, timeout=15)
            if resp.status_code == 404:
                return None
            if resp.status_code >= 400:
                print(f"  [skip] {url}: HTTP {resp.status_code}")
                return None

            html = resp.text
            # Check if it's an empty SPA → need Playwright
            if _looks_like_empty_spa(html):
                print(f"  [spa] {url} — switching to Playwright")
                return fetch_page(url, use_playwright=True)

            return BeautifulSoup(html, "lxml")
        except Exception as e:
            print(f"  [cloudscraper fail] {url}: {e} — trying Playwright")
            return fetch_page(url, use_playwright=True)

    # Tier 2: Playwright
    try:
        browser = _get_playwright_browser()
        page = browser.new_page()
        try:
            page.goto(url, timeout=20000, wait_until="networkidle")
            html = page.content()
        finally:
            page.close()
        return BeautifulSoup(html, "lxml")
    except Exception as e:
        print(f"  [playwright fail] {url}: {e}")
        return None


def extract_text_blocks(soup: BeautifulSoup) -> list[dict]:
    """Extract structured text blocks from a page."""
    blocks = []

    # Remove script, style, nav, footer noise
    for tag in soup.find_all(["script", "style", "noscript"]):
        tag.decompose()

    # Extract headings with their following content
    for heading in soup.find_all(["h1", "h2", "h3", "h4"]):
        text = heading.get_text(strip=True)
        if not text:
            continue

        # Collect sibling paragraphs after this heading
        content_parts = []
        for sibling in heading.find_next_siblings():
            if sibling.name in ["h1", "h2", "h3", "h4"]:
                break
            sib_text = sibling.get_text(strip=True)
            if sib_text:
                content_parts.append(sib_text)

        blocks.append({
            "type": "section",
            "heading": text,
            "content": " ".join(content_parts) if content_parts else "",
            "level": heading.name,
        })

    # Extract standalone paragraphs not already captured
    for p in soup.find_all("p"):
        text = p.get_text(strip=True)
        if text and len(text) > 20:
            # Check if already captured under a heading
            already = any(text in b.get("content", "") for b in blocks)
            if not already:
                blocks.append({"type": "paragraph", "content": text})

    # Extract list items (FAQ, features, etc.)
    for ul in soup.find_all(["ul", "ol"]):
        items = []
        for li in ul.find_all("li", recursive=False):
            li_text = li.get_text(strip=True)
            if li_text:
                items.append(li_text)
        if items:
            blocks.append({"type": "list", "items": items})

    return blocks


def discover_internal_links(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Find all internal links on a page."""
    parsed_base = urlparse(base_url)
    links = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)

        # Same domain only
        if parsed.netloc == parsed_base.netloc:
            # Clean URL: remove fragment, query, normalize trailing slash
            path = parsed.path.rstrip("/") or "/"
            clean = f"{parsed.scheme}://{parsed.netloc}{path}"
            # Skip non-content paths
            if not re.search(r"(cdn-cgi|_wp_link|wp-content|wp-admin|feed)", path):
                links.add(clean)

    return sorted(links)


def scrape_brand_website(brand_id: str, base_url: str | None = None, max_pages: int = 30) -> dict:
    """Scrape seluruh website brand, return structured data.

    Args:
        brand_id: slug brand (dipakai untuk nama output file)
        base_url: URL base website. Kalau None, coba baca dari config brand.
        max_pages: safety cap supaya scrape tidak runaway di website besar
    """
    config = load_brand_config(brand_id)
    if base_url is None:
        base_url = config.get("website_url") or f"https://{brand_id}.com"

    # Normalize base URL (remove trailing slash, ensure scheme)
    base_url = base_url.rstrip("/")
    if not base_url.startswith(("http://", "https://")):
        base_url = "https://" + base_url

    brand_name = config.get("brand_name", brand_id)
    print(f"\n{'='*50}")
    print(f"HELIX Scraper — {brand_name}")
    print(f"Target: {base_url}")
    print(f"{'='*50}\n")

    # Common page paths — scraper akan discover paths lain dari link di homepage
    seed_pages = [
        "/",
        "/about", "/about-us", "/tentang",
        "/services", "/layanan", "/products", "/produk",
        "/contact", "/hubungi", "/kontak",
    ]

    visited = set()
    all_pages = []

    # Scrape seed pages + any discovered internal links
    def normalize(u: str) -> str:
        p = urlparse(u)
        return f"{p.scheme}://{p.netloc}{p.path.rstrip('/') or '/'}"

    to_visit = [normalize(urljoin(base_url, p)) for p in seed_pages]

    for url in to_visit:
        if len(all_pages) >= max_pages:
            print(f"  [limit] Max {max_pages} pages reached — stopping")
            break

        norm = normalize(url)
        if norm in visited:
            continue
        visited.add(norm)

        print(f"  Scraping: {url}")
        soup = fetch_page(url)
        if not soup:
            continue

        # Extract page title
        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else url

        # Extract meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        description = meta_desc["content"] if meta_desc and meta_desc.get("content") else ""

        # Extract text blocks
        blocks = extract_text_blocks(soup)

        # Discover more internal links
        new_links = discover_internal_links(soup, base_url)
        for link in new_links:
            if normalize(link) not in visited and link not in to_visit:
                # Only add content pages, skip assets/media
                if not re.search(r"\.(jpg|png|gif|svg|css|js|pdf|webp)$", link, re.I):
                    to_visit.append(link)

        page_data = {
            "url": url,
            "title": title,
            "meta_description": description,
            "blocks": blocks,
            "links_found": len(new_links),
        }
        all_pages.append(page_data)
        print(f"    -> {len(blocks)} text blocks extracted")

    result = {
        "brand_id": brand_id,
        "brand_name": config["brand_name"],
        "base_url": base_url,
        "scraped_at": datetime.now().isoformat(),
        "pages_scraped": len(all_pages),
        "pages": all_pages,
    }

    # Release Playwright browser (if was used)
    close_playwright()

    return result


def save_result(data: dict, brand_id: str) -> Path:
    """Save scrape result to data/ folder."""
    DATA_DIR.mkdir(exist_ok=True)
    output_path = DATA_DIR / f"{brand_id}_website.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return output_path


def main():
    brand_id = sys.argv[1] if len(sys.argv) > 1 else "fotofusi"

    result = scrape_brand_website(brand_id)
    output_path = save_result(result, brand_id)

    print(f"\n{'='*50}")
    print(f"Done! {result['pages_scraped']} pages scraped")
    print(f"Output: {output_path}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
