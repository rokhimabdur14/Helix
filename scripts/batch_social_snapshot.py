"""Batch update IG/TT handle ke 13 brand config + trigger snapshot per brand.

Workflow:
  1. Update config/brands/{id}.config.json — set instagram_handle + tiktok_handle
  2. Loop sequential per brand × per platform: capture screenshot Playwright +
     vision LLM analyze → write data/{id}_social_profile.json
  3. Print status report

Sequential karena Playwright sync_api pakai global browser state. Aman juga
buat Groq vision rate limit (Llama 4 Scout free tier).

Usage:
  python scripts/batch_social_snapshot.py            # full run
  python scripts/batch_social_snapshot.py --skip-snapshot   # cuma update config
  python scripts/batch_social_snapshot.py --only fotofusi   # 1 brand saja
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]

from src.social import service  # noqa: E402

CONFIG_DIR = ROOT / "config" / "brands"

# brand_id → (instagram_handle, tiktok_handle). None/empty = skip platform.
HANDLES: dict[str, tuple[str | None, str | None]] = {
    "arabi":    ("arabiofficialid",  "Arabi"),
    "edumisi":  ("edumisiofficial",  "edumisi"),
    "eduosmo":  ("eduosmoofficial",  "eduosmoofficial"),
    "edufio":   ("edufioofficial",   "edufioofficial"),
    "eduraya":  ("edurayaofficial",  "edurayaofficial"),
    "edusora":  ("edusoraprivat",    "edusoraprivat"),
    "edulob":   ("edulobprivat",     "edulobprivat"),
    "edubia":   ("edubiaofficial",   "edubiaofficial"),
    "edubisa":  ("edubisaofficial",  "edubisaofficial"),
    "edumoka":  ("edumokaofficial",  "edumokaofficial"),
    "jelaja":   ("jelajaidn",        "jelajaidn"),
    "fotofusi": ("fotofusiofficial", "fotofusiofficial"),
    "edupoint": ("edupoint.official", "edupointofficial"),
}


def update_config_handles(brand_id: str, ig: str | None, tt: str | None) -> bool:
    path = CONFIG_DIR / f"{brand_id}.config.json"
    if not path.exists():
        print(f"  ✗ config not found: {path.name}")
        return False
    with path.open(encoding="utf-8") as f:
        cfg = json.load(f)
    if ig:
        cfg["instagram_handle"] = ig
    if tt:
        cfg["tiktok_handle"] = tt
    with path.open("w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    return True


def run_snapshot(brand_id: str, platform: str, handle: str) -> tuple[bool, str]:
    t0 = time.time()
    try:
        service.snapshot_profile(brand_id, platform, handle)
        # Read back to check status
        from src.social.storage import load_profile

        data = load_profile(brand_id)
        snap = next(
            (s for s in data.get("snapshots", []) if s.get("platform") == platform),
            None,
        )
        elapsed = time.time() - t0
        if snap and snap.get("status") == "ready":
            return True, f"ready in {elapsed:.1f}s"
        err = (snap or {}).get("error", "unknown")
        return False, f"failed in {elapsed:.1f}s — {err[:120]}"
    except Exception as e:
        return False, f"crash: {str(e)[:200]}"


def main(argv: list[str]) -> int:
    skip_snapshot = "--skip-snapshot" in argv
    only = None
    for i, a in enumerate(argv):
        if a == "--only" and i + 1 < len(argv):
            only = argv[i + 1]

    targets = [b for b in HANDLES.keys() if (only is None or b == only)]
    print(f"Target: {len(targets)} brand — {', '.join(targets)}")
    print(f"Snapshot: {'SKIP' if skip_snapshot else 'RUN (sequential)'}\n")

    # Phase 1: update configs
    print("=" * 60)
    print("Phase 1: update configs")
    print("=" * 60)
    for bid in targets:
        ig, tt = HANDLES[bid]
        ok = update_config_handles(bid, ig, tt)
        mark = "✓" if ok else "✗"
        print(f"  {mark} {bid:12} ig={ig or '-':22} tt={tt or '-'}")

    if skip_snapshot:
        return 0

    # Phase 2: snapshots — sequential per (brand, platform) pair
    print("\n" + "=" * 60)
    print("Phase 2: snapshot IG + TT (sequential)")
    print("=" * 60)
    results: list[tuple[str, str, bool, str]] = []
    total_pairs = sum(
        (1 if HANDLES[b][0] else 0) + (1 if HANDLES[b][1] else 0) for b in targets
    )
    done = 0
    for bid in targets:
        ig, tt = HANDLES[bid]
        for platform, handle in [("instagram", ig), ("tiktok", tt)]:
            if not handle:
                continue
            done += 1
            print(f"\n[{done}/{total_pairs}] {bid} · {platform} · @{handle}")
            ok, msg = run_snapshot(bid, platform, handle)
            mark = "✓" if ok else "✗"
            print(f"  {mark} {msg}")
            results.append((bid, platform, ok, msg))

    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    ok_count = sum(1 for _, _, ok, _ in results if ok)
    fail_count = len(results) - ok_count
    print(f"Total: {len(results)} pairs | ✓ {ok_count} ready | ✗ {fail_count} failed")
    if fail_count:
        print("\nFailed:")
        for bid, plat, ok, msg in results:
            if not ok:
                print(f"  · {bid:12} {plat:10} {msg}")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
