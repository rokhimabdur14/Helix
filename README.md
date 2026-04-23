# HELIX

> *"The DNA of your brand, decoded."*

AI-powered social media strategist platform. Multi-tenant, multi-brand.

## What is HELIX?

HELIX membaca "DNA" brand kamu — dari website, sosial media, rate card, brand voice — lalu menghasilkan rekomendasi konten yang konsisten, berbasis data, dan bisa langsung dieksekusi.

## Architecture

```
helix/
├── config/brands/       # Config per brand/tenant (JSON)
├── src/
│   ├── scraper/         # Website & social media scraper
│   ├── analyzer/        # Performa konten analytics
│   ├── ai/              # AI content strategist (Claude API)
│   └── api/             # Backend API
├── dashboard/           # Next.js 15 web dashboard
├── data/                # Local data (not committed)
└── docs/                # Documentation
```

## Stack

| Layer      | Tech                          |
|------------|-------------------------------|
| Data & AI  | Python + Claude API           |
| Database   | Supabase (Postgres + pgvector)|
| Dashboard  | Next.js 15                    |
| APIs       | Meta Graph API, TikTok API    |
| Deploy     | Vercel                        |

## Brands

- **Fotofusi** — Tenant #0 (photography managed marketplace, Yogyakarta)

## Getting Started

> Coming soon — Sprint 1 setup instructions.
