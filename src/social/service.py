"""Orchestrate end-to-end: screenshot → vision analyze → persist.

Functions di sini di-call dari FastAPI BackgroundTasks (sync, sequential).
"""

from src.social import screenshot, storage, vision


def snapshot_profile(brand_id: str, platform: str, handle: str) -> None:
    """Background task: capture profile + analyze + save.

    Idempotent — replace any existing snapshot for same platform.
    Status di-update ke 'ready' atau 'failed' di file JSON.
    """
    url = screenshot.profile_url(platform, handle)  # type: ignore[arg-type]
    try:
        png = screenshot.capture(url, full_page=True, max_height=2400)
        thumb = screenshot.thumbnail_data_url(png, max_dim=600)
        analysis_input = screenshot.to_data_url(png)
        analysis = vision.analyze_profile(analysis_input)
        storage.save_profile_snapshot(
            brand_id,
            platform=platform,
            handle=handle,
            url=url,
            analysis=analysis,
            thumbnail_data_url=thumb,
            status="ready",
        )
    except Exception as e:
        storage.save_profile_failed(
            brand_id,
            platform=platform,
            handle=handle,
            url=url,
            error=str(e)[:300],
        )


def analyze_reference_url(brand_id: str, ref_id: str, url: str) -> None:
    """Background task: capture reference URL + analyze + update entry.

    Reference entry harus udah ada di JSON (status pending) sebelum function ini
    dipanggil — kita tinggal update.
    """
    try:
        png = screenshot.capture(url, full_page=True, max_height=3000)
        thumb = screenshot.thumbnail_data_url(png, max_dim=600)
        analysis_input = screenshot.to_data_url(png)
        analysis = vision.analyze_reference(analysis_input)
        storage.update_reference(
            brand_id,
            ref_id,
            status="ready",
            analysis=analysis,
            thumbnail=thumb,
        )
    except Exception as e:
        storage.update_reference(
            brand_id,
            ref_id,
            status="failed",
            error=str(e)[:300],
        )
