import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (body?.confirmation !== "CLEAR DATABASE") {
    return NextResponse.json({ error: "Confirm clearing all local CRM data." }, { status: 400 });
  }
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    // Do not let an in-flight Meta operation restore data after the reset.
    const active = database.prepare("SELECT 1 FROM hosted_onboarding WHERE status = 'processing' LIMIT 1").get()
      || database.prepare("SELECT 1 FROM coexistence_requests WHERE status = 'requesting' LIMIT 1").get();
    if (active) {
      database.exec("ROLLBACK");
      return NextResponse.json({ error: "Account setup or history import is running. Wait for it to finish before clearing the database." }, { status: 409 });
    }
    const tables = ["connections", "messages", "account_updates", "coexistence_events", "history_messages",
      "history_progress", "contacts", "coexistence_requests", "hosted_onboarding", "signup_attempts", "signup_grants"];
    for (const table of tables) {
      if (database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)) {
        database.exec(`DELETE FROM "${table}"`);
      }
    }
    // Preserve migrations so legacy messages.json is not imported again on restart.
    database.exec("COMMIT");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    database.exec("ROLLBACK");
    return NextResponse.json({ error: "Could not clear database." }, { status: 500 });
  }
}
