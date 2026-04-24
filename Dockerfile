# HELIX backend (FastAPI) Docker image
# Target: Hugging Face Spaces (Docker SDK) free tier
# Convention: bind ke port 7860 (default HF Spaces)

FROM python:3.11-slim

WORKDIR /app

# Minimal OS deps — playwright install --with-deps akan tambah sisanya
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Python deps (cache layer terpisah biar rebuild cepat kalau cuma code yang berubah)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Playwright Chromium + system deps (~300MB chromium + ~100MB libs)
RUN playwright install --with-deps chromium

# App code
COPY . .

# Permisi: HF Space user adalah `user` (UID 1000) di runtime non-root mode.
# Kita pakai default root untuk simpel — works di HF Spaces Docker SDK.

EXPOSE 7860

# Bind 0.0.0.0 supaya container reachable dari luar
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "7860"]
