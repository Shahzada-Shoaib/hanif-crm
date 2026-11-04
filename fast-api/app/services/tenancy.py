from ..database import get_store


async def company_rows_for(user: dict) -> list[dict]:
    if user["role"] == "super_admin" or not user.get("workspaceId"):
        return []

    rows = await get_store().rows(
        "companies",
        filters={"workspace_id": f"eq.{user['workspaceId']}"},
        order="name.asc",
    )
    if user["role"] == "admin":
        return rows

    access = await get_store().rows(
        "user_company_access",
        select="company_id",
        filters={"user_id": f"eq.{user['id']}"},
    )
    allowed = {row["company_id"] for row in access}
    return [row for row in rows if row["id"] in allowed]


async def company_ids_for(user: dict) -> set[str]:
    return {row["id"] for row in await company_rows_for(user)}


async def can_access_company(user: dict, company_id: str | None) -> bool:
    return bool(company_id and company_id in await company_ids_for(user))
