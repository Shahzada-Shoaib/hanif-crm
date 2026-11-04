import asyncio
import logging
import os
from pathlib import Path
from uuid import uuid4

import anyio
import httpx
from fastapi import HTTPException
from fastapi.responses import FileResponse

from ..core.config import ROOT, setting
from ..database import get_store
from .connections import get_connection
from .meta import MetaError, graph

logger = logging.getLogger("uvicorn.error")
_cache_tasks: set[asyncio.Task] = set()
_download_slots = asyncio.Semaphore(3)


def media_root() -> Path:
    configured = setting("MEDIA_ROOT")
    root = Path(configured).expanduser() if configured else ROOT / "storage" / "media"
    if not root.is_absolute():
        root = ROOT / root
    return root.resolve()


def media_path(phone_id: str, media_id: str) -> Path:
    if not phone_id.isdigit() or not media_id.isdigit():
        raise ValueError("Invalid media identifier.")
    return media_root() / phone_id / media_id


def schedule_media_cache(phone_id: str, media_id: str) -> None:
    """Cache webhook media without delaying Meta's webhook response."""
    if not phone_id.isdigit() or not media_id.isdigit():
        return
    task = asyncio.create_task(_cache_in_background(phone_id, media_id))
    _cache_tasks.add(task)
    task.add_done_callback(_cache_tasks.discard)


async def _cache_in_background(phone_id: str, media_id: str) -> None:
    try:
        await cache_media(phone_id, media_id)
    except Exception:
        logger.exception("Could not cache WhatsApp media %s for phone %s", media_id, phone_id)


async def cache_media(phone_id: str, media_id: str) -> Path:
    target = media_path(phone_id, media_id)
    if target.is_file():
        return target

    async with _download_slots:
        if target.is_file():
            return target

        connection = await get_connection(phone_id, include_token=True)
        if not connection:
            raise HTTPException(404, "Connection not found.")

        token = connection["accessToken"]
        try:
            metadata = await graph(f"{media_id}?phone_number_id={phone_id}", token)
        except MetaError as error:
            raise HTTPException(502, str(error)) from error

        url = str(metadata.get("url") or "")
        if not url.startswith("https://"):
            raise HTTPException(502, "Meta did not return a media URL.")

        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(f".{media_id}.{uuid4().hex}.part")
        try:
            await _download_to_file(url, token, temporary)
            await asyncio.to_thread(os.replace, temporary, target)
        finally:
            if temporary.exists():
                await asyncio.to_thread(temporary.unlink, missing_ok=True)
        return target


async def _download_to_file(url: str, token: str, target: Path) -> None:
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120, connect=20)) as client:
            async with client.stream("GET", url, headers=headers) as response:
                if response.status_code != 200:
                    raise HTTPException(502, "Meta could not return this media.")
                async with await anyio.open_file(target, "wb") as output:
                    async for chunk in response.aiter_bytes():
                        await output.write(chunk)
    except httpx.HTTPError as error:
        raise HTTPException(502, "Could not download media from Meta.") from error


async def stream_media(phone_id: str, media_id: str, range_header: str | None) -> FileResponse:
    rows = await get_store().rows(
        "messages",
        select="media_id,media_mime_type,media_filename",
        filters={"phone_number_id": f"eq.{phone_id}", "media_id": f"eq.{media_id}"},
        limit=1,
    )
    if not rows:
        raise HTTPException(404, "Media not found.")

    try:
        target = media_path(phone_id, media_id)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    if not target.is_file():
        target = await cache_media(phone_id, media_id)

    row = rows[0]
    mime_type = row.get("media_mime_type") or "application/octet-stream"
    filename = row.get("media_filename") or f"whatsapp-media-{media_id}"
    # Starlette's FileResponse handles byte ranges for audio and video players.
    return FileResponse(
        target,
        media_type=mime_type,
        filename=filename,
        content_disposition_type="inline",
        headers={"Cache-Control": "private, max-age=300"},
    )
