# HELIX — Deploy Guide (100% Free, No Credit Card)

Deploy stack:
- **Hugging Face Spaces** (backend FastAPI, Docker SDK) — free, 16GB RAM, no sleep, no CC
- **Vercel** (frontend Next.js) — free Hobby tier, no CC
- **Groq Free Tier** (AI) — no CC

Total cost: **$0/bulan**.

## Prerequisites

1. **GitHub** account — already done ✅ (repo: `rokhimabdur14/Helix`)
2. **Hugging Face** account — `https://huggingface.co/join` (free, no CC)
3. **Vercel** account — `https://vercel.com/signup` (login via GitHub)
4. **Groq** API key — `https://console.groq.com` (already pakai)

---

## Step 1 — Deploy Backend ke Hugging Face Spaces

### 1.1 Create Space

1. Buka **https://huggingface.co/new-space**
2. Owner: pilih akun kamu
3. Space name: `helix-api` (atau nama lain)
4. License: `mit`
5. **Select the Space SDK**: pilih **Docker** → **Blank**
6. Hardware: **CPU basic** (free, 16GB RAM)
7. Visibility: Public (kalau Private, frontend perlu auth — pilih Public untuk demo)
8. Klik **Create Space**

### 1.2 Set GROQ_API_KEY sebagai Space secret

1. Di Space yang baru dibuat, klik **Settings** (pojok kanan atas)
2. Scroll ke section **Variables and secrets** → klik **New secret**
3. Name: `GROQ_API_KEY`, Value: paste API key dari `D:\WEB Abdur\helix\.env`
4. Save

### 1.3 Push code dari GitHub repo ke Space

HF Space adalah git repo terpisah. Kita push dari local repo `helix/` ke remote Space.

```bash
cd "D:/WEB Abdur/helix"

# Add HF Space sebagai remote kedua (selain origin GitHub)
git remote add hf https://huggingface.co/spaces/<username>/helix-api

# Push master local → main branch HF Space
git push hf master:main
```

Saat push, HF prompt credential:
- Username: HF username kamu
- Password: **bukan password akun** — pakai **Access Token**:
  - Buka https://huggingface.co/settings/tokens → **New token** → Type: **Write**
  - Paste token sebagai password

### 1.4 Tunggu build

1. Buka Space page kamu → tab **Logs** (atau **Building...** indicator)
2. HF auto-detect Dockerfile → build image (~5-10 menit pertama kali, ada install Chromium)
3. Setelah `Running`, test URL: `https://<username>-helix-api.hf.space/` → `{"name":"HELIX API","status":"ok"}`

**Catat URL:** `https://<username>-helix-api.hf.space`

---

## Step 2 — Deploy Frontend ke Vercel

1. Buka **https://vercel.com/new** → import GitHub repo `rokhimabdur14/Helix`
2. **Root Directory**: klik Edit → ketik `dashboard` (penting! Next.js ada di subdir)
3. Framework Preset: Next.js (auto-detect)
4. **Environment Variables** (klik tambah):
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: `https://<username>-helix-api.hf.space` (dari Step 1.4, **tanpa trailing slash**)
5. Klik **Deploy**
6. Tunggu ~2 menit
7. Catat URL: `https://helix-<...>.vercel.app`

---

## Step 3 — Update CORS untuk accept Vercel domain

Backend kita sudah accept `https://*.hf.space` dan `https://*.vercel.app` lewat regex.
Tapi kalau Vercel kasih custom subdomain weird, mungkin perlu adjust `CORS_ORIGIN_REGEX` di HF Space secrets:

1. HF Space → Settings → Variables and secrets
2. Add variable (bukan secret): `CORS_ORIGIN_REGEX` = `https://.*\.vercel\.app|https://.*\.hf\.space`
3. Restart Space (Settings → Factory rebuild)

---

## Step 4 — Verify End-to-End

Buka URL Vercel → harus tampil HELIX. Cek:
- ✅ Status dot di header **hijau** (backend reachable)
- ✅ Brand `fotofusi` muncul di switcher (demo data ter-bundle)
- ✅ `/analysis` render charts dari fotofusi insights
- ✅ `/studio` bisa generate (test 1 hook untuk verify Groq quota OK)
- ✅ `/` chat bisa free + brand mode

---

## Compromise yang DI-TERIMA di free tier

1. **Filesystem ephemeral** — brand baru yang di-add di production akan **HILANG** setiap HF Space rebuild.
   - Hanya `fotofusi` (demo, di git) yang persistent.
   - Multi-brand persistence butuh Sprint 7 (Supabase Storage migration).

2. **Playwright RAM** — HF Spaces 16GB plenty, scrape harusnya stabil.

3. **Groq quota shared** — 100K TPD (70b chat/plan) shared semua user.
   - ~10 brand chat per hari total. Studio (8b) lebih lega 500K TPD.
   - Hit limit → user dapat error 429 dari Groq.

4. **HF Space pause** — kalau Space tidak diakses 48 jam, bakal di-pause oleh HF (perlu manual unpause via UI). Untuk demo aktif, fine.

---

## Update / redeploy

```bash
# Setelah commit perubahan baru
git push origin master  # update GitHub
git push hf master:main # update HF Space (auto-rebuild)
```

Vercel auto-detect push GitHub → rebuild & redeploy frontend.

---

## Roadmap setelah MVP deploy

- **Sprint 7**: Supabase Storage migration (brand persistence)
- **Sprint 8**: Replace Playwright dengan httpx + BeautifulSoup (lighter)
- **Sprint 9**: Auth via Supabase
- **Sprint 10**: Trend search engine + content replication (gap dari briefing user)
