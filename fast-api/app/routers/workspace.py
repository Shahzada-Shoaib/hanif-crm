from fastapi import APIRouter, Depends, HTTPException, Request
from ..core.config import setting
from ..core.security import require_user
from ..database import get_store
from ..services.connections import delete_connection, import_account, list_connections, offboard_connection
from ..services.meta import MetaError
from ..services.access import accessible_connection, require_role
from ..services.tenancy import company_rows_for

router = APIRouter(prefix="/api", tags=["workspace"])


@router.get("/bootstrap")
async def bootstrap(user: dict = Depends(require_user)):
    company_rows = await company_rows_for(user)
    return {
        "user": user,
        "connections": await list_connections(user),
        "companies": [{"id": row["id"], "name": row["name"], "createdAt": int(row["created_at"])} for row in company_rows],
        "meta": {"appId": setting("META_APP_ID"), "version": setting("META_GRAPH_VERSION", default="v26.0"), "configId": setting("META_EMBEDDED_CONFIG_ID", default="3264827733702626")},
    }


@router.get("/whatsapp/connections")
async def connections(user: dict = Depends(require_user)):
    return {"connections": await list_connections(user)}


@router.post("/whatsapp/connections")
async def sync_connections(request: Request, user: dict = Depends(require_user)):
    require_role(user, "admin")
    body = await request.json()
    saved = await accessible_connection(user, body.get("phoneNumberId", ""), include_token=True)
    if body.get("action") != "sync" or not saved:
        raise HTTPException(404, "Connection not found.")
    result = await import_account(saved["wabaId"], saved["accessToken"], saved["companyId"])
    return {"ok": True, **result, "connections": await list_connections(user)}


@router.post("/whatsapp/connections/offboard")
async def offboard(request: Request, user: dict = Depends(require_user)):
    require_role(user, "admin")
    body = await request.json()
    phone_id = str(body.get("phoneNumberId", ""))
    if body.get("confirmation") != "DISCONNECT" or not phone_id.isdigit():
        raise HTTPException(400, "Confirm disconnecting this WhatsApp number.")
    try:
        await accessible_connection(user, phone_id)
        updated = await offboard_connection(phone_id, user)
    except ValueError as error:
        raise HTTPException(404, str(error)) from error
    except MetaError as error:
        raise HTTPException(502, str(error)) from error
    return {"ok": True, "connections": updated}


@router.delete("/whatsapp/connections/{phone_id}")
async def delete_whatsapp_connection(phone_id: str, request: Request, user: dict = Depends(require_user)):
    require_role(user, "admin")
    body = await request.json()
    if body.get("confirmation") != "DELETE ALL DATA" or not phone_id.isdigit():
        raise HTTPException(400, "Confirm permanently deleting this WhatsApp number and its data.")
    try:
        await accessible_connection(user, phone_id)
        updated = await delete_connection(phone_id, user)
    except ValueError as error:
        raise HTTPException(404, str(error)) from error
    return {"ok": True, "connections": updated}
