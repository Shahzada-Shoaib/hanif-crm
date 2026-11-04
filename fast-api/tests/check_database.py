"""Read-only schema checks plus a temporary write/read database smoke test."""

import asyncio
import sys
from pathlib import Path

import asyncpg


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import required  # noqa: E402


REQUIRED_TABLES = {
    "account_updates",
    "coexistence_requests",
    "companies",
    "connections",
    "contacts",
    "conversations",
    "crm_sessions",
    "crm_users",
    "history_messages",
    "history_progress",
    "hosted_onboarding",
    "messages",
    "onboarding_intents",
    "user_company_access",
    "workspaces",
}

REQUIRED_FUNCTIONS = {
    "clear_crm_data",
    "list_crm_conversation_messages",
    "list_crm_conversations",
    "mark_crm_conversation_read",
    "persist_crm_message",
}


async def main() -> int:
    connection = await asyncpg.connect(required("DATABASE_URL"))
    try:
        database = await connection.fetchval("SELECT current_database()")
        table_rows = await connection.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        )
        function_rows = await connection.fetch(
            "SELECT proname FROM pg_proc p "
            "JOIN pg_namespace n ON n.oid = p.pronamespace "
            "WHERE n.nspname = 'public'"
        )
        tables = {row["tablename"] for row in table_rows}
        functions = {row["proname"] for row in function_rows}
        missing_tables = sorted(REQUIRED_TABLES - tables)
        missing_functions = sorted(REQUIRED_FUNCTIONS - functions)

        # A temporary table proves this configured database can write and read.
        # PostgreSQL removes it automatically when this connection closes.
        await connection.execute(
            "CREATE TEMP TABLE codex_database_smoke_test "
            "(id integer PRIMARY KEY, value text NOT NULL)"
        )
        await connection.execute(
            "INSERT INTO codex_database_smoke_test (id, value) VALUES ($1, $2)",
            1,
            "stored-ok",
        )
        stored_value = await connection.fetchval(
            "SELECT value FROM codex_database_smoke_test WHERE id = $1", 1
        )

        print(f"Connection: OK ({database})")
        print(f"Temporary write/read: {'OK' if stored_value == 'stored-ok' else 'FAILED'}")
        print(f"Required tables: {'OK' if not missing_tables else 'MISSING'}")
        if missing_tables:
            print("  " + ", ".join(missing_tables))
        print(f"Required functions: {'OK' if not missing_functions else 'MISSING'}")
        if missing_functions:
            print("  " + ", ".join(missing_functions))

        return int(
            stored_value != "stored-ok" or bool(missing_tables) or bool(missing_functions)
        )
    finally:
        await connection.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
