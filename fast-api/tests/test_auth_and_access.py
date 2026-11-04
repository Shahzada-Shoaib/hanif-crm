import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.services.access import require_role
from app.services.auth import password_matches, password_record, register, validate_username
from app.services.tenancy import can_access_company


class PasswordTests(unittest.TestCase):
    def test_password_hash_round_trip(self):
        salt, digest = password_record("a-secure-password")
        self.assertTrue(password_matches("a-secure-password", salt, digest))
        self.assertFalse(password_matches("wrong-password", salt, digest))

    def test_username_is_normalized(self):
        self.assertEqual(validate_username("  Agent.One  "), "agent.one")


class AccessTests(unittest.IsolatedAsyncioTestCase):
    async def test_super_admin_cannot_open_tenant_companies(self):
        self.assertFalse(await can_access_company({"role": "super_admin", "workspaceId": None}, "company-b"))

    async def test_company_user_is_limited_to_assigned_companies(self):
        store = AsyncMock()
        store.rows.side_effect = [
            [{"id": "company-a", "workspace_id": "workspace-a"}, {"id": "company-b", "workspace_id": "workspace-a"}],
            [{"company_id": "company-a"}],
            [{"id": "company-a", "workspace_id": "workspace-a"}, {"id": "company-b", "workspace_id": "workspace-a"}],
            [{"company_id": "company-a"}],
        ]
        user = {"id": "user-1", "role": "user", "workspaceId": "workspace-a"}
        with patch("app.services.tenancy.get_store", return_value=store):
            self.assertTrue(await can_access_company(user, "company-a"))
            self.assertFalse(await can_access_company(user, "company-b"))

    async def test_role_guard_rejects_regular_user(self):
        with self.assertRaises(HTTPException) as error:
            require_role({"role": "user"}, "admin", "super_admin")
        self.assertEqual(error.exception.status_code, 403)


class RegistrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_registration_creates_workspace_admin_and_session(self):
        store = AsyncMock()
        store.rows.return_value = []
        async def insert(table, body, *args):
            return [body] if table == "crm_users" else []
        store.insert.side_effect = insert

        with patch("app.services.auth.get_store", return_value=store):
            user, token = await register({
                "workspaceName": "Example Co", "displayName": "Owner",
                "username": "owner", "password": "secure-pass",
            })

        saved_user = store.insert.await_args_list[1].args[1]
        self.assertEqual(saved_user["role"], "admin")
        self.assertEqual(user["workspaceId"], saved_user["workspace_id"])
        self.assertTrue(token)
