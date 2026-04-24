---
title: HELIX API
emoji: 🧬
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: AI Social Media Strategist — backend API
---

# HELIX

> *"The DNA of your brand, decoded."*

AI Social Media Management Expert. Multi-tenant, multi-brand. Inspired by Comet (Perplexity) tapi specialized untuk social media.

## Features

- **Brand Chat** — AI strategist dengan context lengkap (website + insights data)
- **Free Chat** — tanya apa saja tentang sosmed, no brand needed
- **Studio** — generate Plan / Hook / Caption / Carousel per brand
- **Analysis** — visualisasi performance konten (by format, pillar, hour, top posts)
- **Expertise** — TikTok algorithm + growth tactics di-inject ke semua AI prompts

## Stack

| Layer      | Tech                          |
|------------|-------------------------------|
| AI         | Groq (Llama 3.3 70B + 3.1 8B) |
| Backend    | Python 3.11 + FastAPI         |
| Frontend   | Next.js 16 (React 19)         |
| Scraper    | Playwright (Chromium)         |
| Deploy     | Hugging Face Spaces (backend) + Vercel (frontend) |

## Architecture

```
helix/
├── config/brands/       # Brand configs (JSON)
├── src/
│   ├── scraper/         # Website scraper (Playwright)
│   ├── analyzer/        # CSV insights parser
│   ├── ai/              # AI brain + studio generators
│   └── api/             # FastAPI endpoints
├── dashboard/           # Next.js dashboard
├── data/                # Brand data + expertise knowledge base
├── scripts/             # One-shot utilities (PDF→expertise extraction)
└── Dockerfile           # Backend container (HF Spaces)
```

## Endpoints

- `GET /` — health check
- `GET /brands` — list brands
- `POST /brands` — create + scrape new brand
- `GET /brands/{id}/insights` — performance data
- `POST /chat` — chat (brand_id null = free mode)
- `POST /studio/{hook,caption,carousel,plan}` — content generators
- `GET /expertise` — list active knowledge sources

## Local Dev

```bash
# Backend
cd helix
python -m venv .venv && source .venv/Scripts/activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env  # set GROQ_API_KEY
uvicorn src.api.main:app --reload

# Frontend (terminal lain)
cd helix/dashboard
npm install
cp .env.example .env.local  # default API_URL ok untuk dev
npm run dev
```

## Deploy

See `DEPLOY.md` for Hugging Face Spaces + Vercel deploy instructions.

## Brands

- **Fotofusi** — Demo brand (managed marketplace fotografi Yogyakarta), bundled di repo untuk live demo.
