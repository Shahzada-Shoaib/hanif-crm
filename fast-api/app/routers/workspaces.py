from fastapi import APIRouter, Depends, HTTPException, Request

from ..core.security import require_user
from ..database import get_store
from ..services.access import require_role

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


@router.get("")
async def list_workspaces(user: dict = Depends(require_user)):
    require_role(user, "super_admin")
    workspaces = await get_store().rows("workspaces", order="created_at.desc")
    users = await get_store().rows("crm_users", select="workspace_id,role,status,display_name,username,created_at")
    companies = await get_store().rows("companies", select="id,workspace_id,name")
    connections = await get_store().rows("connections", select="company_id,status")
    workspace_by_company = {row["id"]: row["workspace_id"] for row in companies}

    accounts = []
    for workspace in workspaces:
        members = [item for item in users if item.get("workspace_id") == workspace["id"]]
        owner = next((item for item in sorted(members, key=lambda item: int(item["created_at"])) if item["role"] == "admin"), None)
        if not owner:
            continue
        team_users = [item for item in members if item["role"] == "user"]
        workspace_companies = [item for item in companies if item["workspace_id"] == workspace["id"]]
        accounts.append({
            "id": workspace["id"],
            "workspaceName": workspace["name"],
            "displayName": owner["display_name"],
            "username": owner["username"],
            "status": workspace["status"],
            "createdAt": int(owner["created_at"]),
            "users": [{
                "displayName": member["display_name"],
                "username": member["username"],
                "status": member["status"],
                "createdAt": int(member["created_at"]),
            } for member in sorted(team_users, key=lambda item: int(item["created_at"]))],
            "companyList": [{"id": company["id"], "name": company["name"]} for company in workspace_companies],
            "connections": sum(1 for item in connections if item.get("status", "active") == "active" and workspace_by_company.get(item.get("company_id")) == workspace["id"]),
        })
    return {"accounts": accounts}


@router.patch("/{workspace_id}")
async def set_workspace_status(workspace_id: str, request: Request, user: dict = Depends(require_user)):
    require_role(user, "super_admin")
    status = str((await request.json()).get("status") or "")
    if status not in ("active", "disabled"):
        raise HTTPException(400, "Invalid workspace status.")
    updated = await get_store().update("workspaces", {"status": status}, {"id": f"eq.{workspace_id}"})
    if not updated:
        raise HTTPException(404, "Workspace not found.")
    if status == "disabled":
        members = await get_store().rows("crm_users", select="id", filters={"workspace_id": f"eq.{workspace_id}"})
        for member in members:
            await get_store().delete("crm_sessions", {"user_id": f"eq.{member['id']}"})
    return {"ok": True, "status": status}
