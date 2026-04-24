# HELIX — Deploy Guide (Free Tier)

Deploy stack: **Vercel (frontend) + Render (backend) + Groq Free Tier (AI)**.
Total cost: $0/bulan untuk demo/portfolio. Untuk traffic real, upgrade Groq Dev tier.

## Prerequisites

1. Akun **GitHub** (free) — `https://github.com/signup`
2. Akun **Vercel** (free Hobby) — `https://vercel.com/signup` (login pakai GitHub)
3. Akun **Render** (free) — `https://render.com/register` (login pakai GitHub)
4. Akun **Groq** + API key — `https://console.groq.com` (sudah dipakai sekarang)

---

## Step 1 — Push code ke GitHub

```bash
cd "D:/WEB Abdur/helix"

# Buat repo baru di github.com (private boleh), copy URL-nya
git remote add origin https://github.com/<username>/helix.git

# Stage + commit semua perubahan sejak Sprint 1
git add .
git commit -m "Sprint 1-6: Studio, Analysis, expertise, deploy config"
git push -u origin master
```

---

## Step 2 — Deploy Backend ke Render

1. Buka **https://render.com** → New + → **Blueprint**
2. Connect GitHub repo `helix`
3. Render auto-detect `render.yaml` di root → preview config
4. Klik **Apply**
5. Setelah service dibuat, masuk ke **Environment** tab:
   - Set `GROQ_API_KEY` = (paste API key dari Groq console)
   - `CORS_ORIGIN_REGEX` sudah default `https://.*\.vercel\.app` (boleh tweak nanti)
6. Tunggu build selesai (~5-10 menit pertama kali)
7. Catat URL public, mis: `https://helix-api.onrender.com`
8. Test: `curl https://helix-api.onrender.com/` → harus return `{"name":"HELIX API","status":"ok"}`

**Catatan:** Free tier sleeps after 15 min idle. Request pertama setelah idle butuh 30-60 detik wake up. Status indicator di frontend kita yang sudah ada akan auto-detect.

---

## Step 3 — Deploy Frontend ke Vercel

1. Buka **https://vercel.com/new** → import repo `helix`
2. **Root Directory**: pilih `dashboard/` (penting!)
3. Framework Preset: Next.js (auto-detect)
4. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL` = `https://helix-api.onrender.com` (URL Render dari Step 2)
5. Klik **Deploy**
6. Tunggu ~2 menit
7. Catat URL public, mis: `https://helix-abdur.vercel.app`

---

## Step 4 — Verify

Buka URL Vercel → harus tampil HELIX. Cek:
- ✅ Status dot di header hijau (backend reachable)
- ✅ Brand `fotofusi` muncul di switcher (demo data ter-bundle)
- ✅ `/analysis` render charts dari fotofusi insights
- ✅ `/studio` bisa generate (test 1 hook untuk verify Groq quota OK)
- ✅ `/` chat bisa free + brand mode

---

## Compromise yang DI-TERIMA di free tier

1. **Cold start Render 30-60s** — request pertama setelah 15 min idle akan slow.
   - Mitigasi: status indicator kasih signal "Backend offline → online" transition.

2. **Filesystem ephemeral** — brand baru yang di-add di production akan **HILANG** setiap Render restart/deploy.
   - Hanya `fotofusi` (demo, di git) yang persistent.
   - Multi-brand persistence butuh Sprint 7 (Supabase Storage migration).

3. **Playwright RAM tight** — scrape brand baru bisa OOM di 512MB Render.
   - Fallback: error message kasih hint manual.

4. **Groq quota shared** — 100K TPD (70b chat/plan) shared semua user.
   - ~10 brand chat per hari total. Studio (8b) lebih lega 500K TPD.
   - Hit limit → user dapat error 429 dari Groq.

---

## Update / redeploy

```bash
git add .
git commit -m "Update: ..."
git push
```

- Render: auto-detect push, rebuild & redeploy (~5-7 menit)
- Vercel: auto-detect push, rebuild & redeploy (~2 menit)

---

## Roadmap setelah MVP deploy

- **Sprint 7**: Supabase Storage migration (brand persistence)
- **Sprint 8**: Replace Playwright dengan httpx + BeautifulSoup (RAM safe)
- **Sprint 9**: Auth via Supabase
- **Sprint 10**: Trend search engine + content replication (gap dari briefing user)
