# Phoenix → HELIX AI Logo Transformation Assets

Used by `/welcome` page (Sprint 15) as a 3-stage transformation reveal:

| Stage | File | Used When | Duration |
|---|---|---|---|
| 1 | `phoenix-1-wings-wide.jpg` | Intro — dramatic full-spread phoenix | 2.4s |
| 2 | `phoenix-2-folded.jpg` | Settling — elegant folded phoenix | 2.4s |
| 3 | `phoenix-3-logo.jpg` | Final — HELIX AI logo | stays |

## Asset spec

- **Format**: JPEG progressive, quality 85
- **Size**: 800x800 px square
- **File size target**: <200 KB per frame
- **Color**: dark BG (matches HELIX brand violet→black→blue gradient)
- **Source**: dropped into `D:\WEB Abdur\helix\LOGO\` (ChatGPT-generated)
- **Optimization script**: see commit message for Sprint 15

## Mengganti / menambah frame

Mau extend ke true image sequence (10-60 frames)? Modify `dashboard/app/welcome/WelcomeIntro.js`:
- Edit `FRAMES` array — tambah objek per frame baru
- Adjust `duration` per stage (ms)
- Pre-load semua frames via `<link rel="preload">` di `<head>` kalau perlu smoother playback
- Consider WebM video instead of PNG sequence kalau >20 frames (better compression)

## Update brand mark (logo final)

Kalau mau pakai logo phoenix ini sebagai brand mark utama (replace `helix-mark.png` di header), update di:
- `dashboard/app/AppHeader.js` line ~34 — `<Image src="/brand/helix-mark.png" ...>`
- `dashboard/app/icon.svg` — favicon
- `dashboard/app/opengraph-image.png` — OG/Twitter card (regenerate via PIL script)

Current setup: phoenix logo HANYA dipakai di welcome page (Sprint 15). Brand mark utama tetap ribbon-H (Sprint 13).
