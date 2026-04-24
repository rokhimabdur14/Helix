# Brand Config Schema

Setiap brand disimpan sebagai `{brand_id}.config.json`.

## Required (minimal starter config)

```json
{
  "brand_id": "mybrand",
  "brand_name": "My Brand",
  "website_url": "https://mybrand.com"
}
```

Cukup 3 field ini untuk onboard brand baru. Sisanya opsional.

## Optional (isi pelan-pelan / auto-populated dari website scrape)

```json
{
  "tagline": "...",
  "positioning": "...",
  "base_city": "...",
  "founded": "YYYY-MM",

  "brand_voice": {
    "tone": ["..."],
    "language": "id",
    "style_notes": ["..."]
  },

  "target_personas": [
    { "id": "...", "label": "...", "priority": "high|medium|low" }
  ],

  "services": [
    {
      "category": "...",
      "tiers": [{ "name": "...", "price": 0 }]
    }
  ],

  "content_strategy": {
    "real_footage_categories": ["..."],
    "stock_categories": ["..."],
    "content_pillars": ["..."]
  },

  "social_media": {
    "platforms": [
      { "name": "Instagram", "type": "Business", "status": "active" }
    ]
  }
}
```

## Flow onboarding
1. User input minimal 3 field required
2. HELIX auto-scrape website → simpan `data/{brand_id}_website.json`
3. User/AI pelan-pelan isi field opsional via dashboard
