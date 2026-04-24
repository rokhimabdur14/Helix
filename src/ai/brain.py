"""
HELIX — AI Brain
Social media management expert powered by Groq (Llama 3.3 70B).
Membaca DNA brand dari data scraper, lalu bertindak sebagai expert strategist.
"""

import io
import json
import os
import sys
import time
from pathlib import Path

# Force UTF-8 output on Windows (for emoji support)
if sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

from dotenv import load_dotenv
from groq import Groq

# Load environment
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

DATA_DIR = PROJECT_ROOT / "data"
CONFIG_DIR = PROJECT_ROOT / "config" / "brands"

# Groq client (auto-reads GROQ_API_KEY from env)
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"


# Core pages get full content. Others get title + meta only.
CORE_PATHS = ("/", "/tentang", "/layanan", "/hubungi")


def load_brand_knowledge(brand_id: str, max_chars: int = 30000) -> str:
    """Load brand config + compressed website data.

    Strategy:
    - Brand config: full (compact JSON)
    - Core pages (home, about, services, contact): full text
    - Service detail pages: title + meta description only (to stay under token limit)
    """
    parts = []

    # 1. Brand config (always full)
    config_path = CONFIG_DIR / f"{brand_id}.config.json"
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        parts.append("=== BRAND CONFIG ===")
        parts.append(json.dumps(config, ensure_ascii=False, indent=2))

    # 2. Insights / performance data (compressed — aggregates + top posts only)
    insights_path = DATA_DIR / f"{brand_id}_insights.json"
    if insights_path.exists():
        with open(insights_path, "r", encoding="utf-8") as f:
            insights = json.load(f)

        parts.append("\n=== SOCIAL MEDIA PERFORMANCE DATA ===")
        parts.append(f"Data range: {insights['posts'][0]['date']} s/d {insights['posts'][-1]['date']}")
        parts.append(f"\nAggregate stats:")
        parts.append(json.dumps(insights["aggregates"], ensure_ascii=False, indent=2))

        parts.append(f"\n--- Semua post ({len(insights['posts'])} posts) ---")
        for p in insights["posts"]:
            line = (
                f"[{p['date']} {p['posted_time']} {p['day_of_week']}] "
                f"{p['type']} | {p['content_pillar']} | "
                f"reach {p['reach']}, ER {p['engagement_rate']}%, +{p['follows']}f | "
                f"\"{p['caption'][:80]}\""
            )
            parts.append(line)

    # 3. Scraped website data (compressed)
    website_path = DATA_DIR / f"{brand_id}_website.json"
    if website_path.exists():
        with open(website_path, "r", encoding="utf-8") as f:
            website = json.load(f)

        parts.append("\n=== WEBSITE CORE PAGES ===")
        service_pages = []

        for page in website.get("pages", []):
            url = page["url"]
            path = url.replace(f"https://{brand_id}.com", "") or "/"

            if path in CORE_PATHS:
                # Full content for core pages
                parts.append(f"\n--- Page: {url} ---")
                parts.append(f"Title: {page.get('title', '')}")
                for block in page.get("blocks", []):
                    if block["type"] == "section":
                        parts.append(f"\n## {block['heading']}")
                        if block.get("content"):
                            parts.append(block["content"])
                    elif block["type"] == "paragraph":
                        parts.append(block["content"])
                    elif block["type"] == "list":
                        for item in block["items"]:
                            parts.append(f"  - {item}")
            else:
                # Just title + meta for service detail pages
                service_pages.append({
                    "url": url,
                    "title": page.get("title", ""),
                    "meta": page.get("meta_description", ""),
                })

        if service_pages:
            parts.append("\n=== SERVICE CATALOG (titles only) ===")
            for sp in service_pages:
                parts.append(f"- {sp['title']}")
                if sp["meta"]:
                    parts.append(f"  Meta: {sp['meta'][:150]}")

    result = "\n".join(parts)

    # Safety cap: hard-truncate if still too big
    if len(result) > max_chars:
        result = result[:max_chars] + "\n\n[...truncated for token limit...]"

    return result


FREE_SYSTEM_PROMPT = """Kamu adalah HELIX — AI Social Media Strategist (Free Mode).

PERAN:
- Kamu ahli sosmed yang menjawab pertanyaan umum tanpa context brand spesifik
- Tugasmu: kasih insight, framework, taktik, contoh konkret berbasis prinsip social media
- User belum input brand mereka, jadi JANGAN asumsi industri/produk apapun
- Kalau pertanyaan butuh context brand spesifik (mis. "kasih caption buat post saya"),
  minta user info penting dulu (industri, target audience, goal post)

ATURAN:
- Bahasa Indonesia kasual-profesional (boleh campur istilah marketing Inggris)
- Spesifik & actionable — kasih angka, framework named, do/don't list
- Pakai prinsip dari HELIX expertise yang ada di context (algoritma TikTok, growth tactics)
- Saran realistis untuk creator/SMB Indonesia
- Hindari saran generik ("buat konten yang menarik") — kasih angka & langkah konkret
- Tip: arahkan ke fitur Studio HELIX (Plan/Hook/Caption/Carousel) kalau cocok

GAYA:
- Profesional tapi santai
- To the point
- Emoji secukupnya
- Kalau panjang, pakai bullet/numbered list
"""


def build_free_system_prompt() -> str:
    """Build free-mode system prompt with HELIX expertise loaded."""
    # Lazy import biar nggak circular dependency
    from src.ai.studio import load_expertise
    expertise_text, _ = load_expertise()
    if expertise_text:
        return f"{FREE_SYSTEM_PROMPT}\n\n=== HELIX EXPERTISE ===\n{expertise_text}"
    return FREE_SYSTEM_PROMPT


SYSTEM_PROMPT = """Kamu adalah HELIX — AI Social Media Management Expert.

PERAN:
- Kamu adalah ahli strategi social media yang sudah sangat berpengalaman
- Kamu sudah "menghafal" semua data brand + data performa sosmed yang diberikan di bawah
- Kamu memberikan saran yang ACTIONABLE dan bisa langsung dieksekusi
- Kamu paham algoritma Instagram & TikTok
- Kamu bisa baca data performa (reach, engagement rate, follows) dan temukan pattern

ATURAN:
- Jawab dalam Bahasa Indonesia (boleh campur istilah marketing/teknis Inggris)
- SELALU rujuk data performa real saat kasih rekomendasi (sebut angka, post ID, atau tanggal)
- Rekomendasi harus realistis — pertimbangkan footage/aset yang brand punya
- Selalu kasih contoh konkret (caption, hashtag, format post, jam posting)
- Jangan kasih saran generik — harus spesifik untuk brand ini
- Kalau ditanya "next post apa", kasih 3 opsi dengan alasan berbasis data

GAYA KOMUNIKASI:
- Profesional tapi santai
- To the point, tidak bertele-tele
- Gunakan emoji secukupnya untuk readability
- Kalau kasih analisis, pakai angka dari data — jangan ngarang
"""


class HelixChat:
    """Stateful chat session with conversation history."""

    def __init__(self, brand_id: str):
        self.brand_id = brand_id
        knowledge = load_brand_knowledge(brand_id)
        system_content = f"{SYSTEM_PROMPT}\n\n=== DATA BRAND ===\n{knowledge}"

        self.messages = [
            {"role": "system", "content": system_content}
        ]

    def send(self, user_message: str, max_retries: int = 3) -> str:
        self.messages.append({"role": "user", "content": user_message})

        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model=MODEL,
                    messages=self.messages,
                    temperature=0.7,
                    max_tokens=2048,
                )
                reply = response.choices[0].message.content
                self.messages.append({"role": "assistant", "content": reply})
                return reply
            except Exception as e:
                err = str(e)
                if "429" in err and attempt < max_retries - 1:
                    wait = 30 * (attempt + 1)
                    print(f"\n[Rate limit] Menunggu {wait}s sebelum retry...")
                    time.sleep(wait)
                else:
                    # Remove the failed user message from history
                    self.messages.pop()
                    raise


def interactive_mode(brand_id: str):
    """Run interactive chat session."""
    print(f"\n{'='*50}")
    print(f"HELIX AI Brain — {brand_id}")
    print(f"Model: {MODEL} (Groq, free tier)")
    print(f"Ketik 'exit' untuk keluar")
    print(f"{'='*50}\n")

    print("Loading brand knowledge...")
    chat = HelixChat(brand_id)
    print("Ready! Tanya apa saja tentang strategi sosmed.\n")

    while True:
        try:
            question = input("Kamu: ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not question:
            continue
        if question.lower() in ("exit", "quit", "q"):
            break

        print("\nHELIX: ", end="", flush=True)
        try:
            answer = chat.send(question)
            print(answer)
        except Exception as e:
            print(f"[ERROR] {e}")
        print()

    print("\nSampai jumpa!")


def single_query(brand_id: str, question: str) -> str:
    """Single question mode (for automation/API)."""
    chat = HelixChat(brand_id)
    return chat.send(question)


if __name__ == "__main__":
    brand_id = sys.argv[1] if len(sys.argv) > 1 else "fotofusi"

    if len(sys.argv) > 2:
        question = " ".join(sys.argv[2:])
        answer = single_query(brand_id, question)
        print(answer)
    else:
        interactive_mode(brand_id)
