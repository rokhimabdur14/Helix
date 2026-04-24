"""
Extract PDF knowledge → ringkas via LLM → save sebagai markdown expertise file.

Output: data/expertise/<slug>.md (compact, dipakai di studio prompts)

Usage:
    python scripts/extract_expertise.py
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pypdf import PdfReader  # noqa: E402

from src.ai.brain import client  # noqa: E402

EXPERTISE_DIR = PROJECT_ROOT / "data" / "expertise"
EXPERTISE_DIR.mkdir(parents=True, exist_ok=True)

# Source PDFs → output slug + topic label
SOURCES = [
    {
        "slug": "tiktok-algorithm",
        "label": "TikTok Algorithm & FYP",
        "path": r"D:\WEB Abdur\Kuasai-Algoritma-TikTok-Panduan-FYP-Lengkap-2026.pdf",
    },
    {
        "slug": "tiktok-growth",
        "label": "TikTok Growth Hacks 0 → 100K",
        "path": r"D:\WEB Abdur\TikTok-Growth-Hacks-Dari-Nol-Hingga-100K-Followers.pdf",
    },
]

SUMMARIZE_MODEL = "llama-3.3-70b-versatile"

SUMMARIZE_PROMPT = """Kamu adalah HELIX Knowledge Curator. Tugasmu: ringkas materi training di bawah
menjadi knowledge file yang KOMPAK & ACTIONABLE untuk dipakai sebagai context AI saat
generate konten sosmed (hook, caption, carousel, plan).

ATURAN OUTPUT:
- Format: Markdown
- Panjang: 1500-3000 kata maksimum (ringkas tapi padat insight)
- Bahasa: Indonesia
- Struktur per section dengan ## heading
- Fokus ke TAKTIK & PRINSIP yang bisa langsung dipakai (bukan teori panjang)
- Hilangkan filler, intro/outro, anekdot panjang, marketing speak penulis
- Sertakan: angka spesifik (durasi, frekuensi, threshold), framework yang named, do/don't list
- Setiap section diawali 1 kalimat thesis, lalu bullet points actionable

JANGAN:
- Salin verbatim dari sumber
- Kasih opini sendiri yang bukan dari materi
- Tambahkan disclaimer atau intro panjang"""


def extract_pdf(path: str) -> str:
    reader = PdfReader(path)
    parts = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            parts.append(text)
    return "\n\n".join(parts)


def summarize(label: str, raw_text: str) -> str:
    user_prompt = f"""SUMBER: {label}

=== RAW TEXT ===
{raw_text}

=== TUGAS ===
Ringkas jadi expertise markdown yang siap dipakai HELIX AI sebagai knowledge base."""

    response = client.chat.completions.create(
        model=SUMMARIZE_MODEL,
        messages=[
            {"role": "system", "content": SUMMARIZE_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,  # low — kita mau faithful summary, bukan creative
        max_tokens=4000,
    )
    return response.choices[0].message.content


def process_source(source: dict) -> dict:
    print(f"\n[{source['slug']}] extracting from PDF...")
    raw = extract_pdf(source["path"])
    print(f"[{source['slug']}] raw: {len(raw)} chars, ~{len(raw.split())} words")

    # Save raw cache
    raw_path = EXPERTISE_DIR / f"_raw_{source['slug']}.txt"
    raw_path.write_text(raw, encoding="utf-8")

    print(f"[{source['slug']}] summarizing via {SUMMARIZE_MODEL}...")
    summary = summarize(source["label"], raw)
    print(f"[{source['slug']}] summary: {len(summary)} chars")

    # Save markdown with frontmatter
    md_content = f"""---
slug: {source['slug']}
label: {source['label']}
source_path: {source['path']}
generated_by: scripts/extract_expertise.py
model: {SUMMARIZE_MODEL}
---

{summary}
"""
    md_path = EXPERTISE_DIR / f"{source['slug']}.md"
    md_path.write_text(md_content, encoding="utf-8")
    print(f"[{source['slug']}] → {md_path}")

    return {"slug": source["slug"], "label": source["label"], "path": str(md_path)}


def main():
    results = []
    for source in SOURCES:
        if not Path(source["path"]).exists():
            print(f"SKIP {source['slug']}: file not found at {source['path']}")
            continue
        try:
            results.append(process_source(source))
        except Exception as e:
            print(f"ERROR {source['slug']}: {e}")

    # Build index file (manifest of all expertise)
    index_lines = ["# HELIX Expertise Knowledge Base", ""]
    for r in results:
        index_lines.append(f"- **{r['label']}** → `{r['slug']}.md`")
    index_path = EXPERTISE_DIR / "index.md"
    index_path.write_text("\n".join(index_lines) + "\n", encoding="utf-8")
    print(f"\nIndex: {index_path}")
    print(f"Done. {len(results)} expertise files generated.")


if __name__ == "__main__":
    main()
