from fastapi import APIRouter, Depends, Header, HTTPException

from ..core.security import require_user
from ..services.access import accessible_connection
from ..services.media import stream_media

router = APIRouter(prefix="/api/whatsapp/media", tags=["media"])


@router.get("/{phone_id}/{media_id}")
async def get_media(phone_id: str, media_id: str, range_header: str | None = Header(None, alias="Range"), user: dict = Depends(require_user)):
    if not phone_id.isdigit() or not media_id.isdigit():
        raise HTTPException(400, "Invalid media identifier.")
    await accessible_connection(user, phone_id)
    return await stream_media(phone_id, media_id, range_header)
