import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getConnection } from "@/lib/connections";
import { historyStatus } from "@/lib/coexistence-events";
import { startCoexistenceSync } from "@/lib/coexistence-sync";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request); if (denied) return denied;
  const id = request.nextUrl.searchParams.get("phoneNumberId") || "";
  if (!getConnection(id)) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
  return NextResponse.json(historyStatus(id), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request); if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (typeof body?.phoneNumberId !== "string" || !getConnection(body.phoneNumberId)) {
    return NextResponse.json({ error: "Select an imported number first." }, { status: 400 });
  }
  try { return NextResponse.json(await startCoexistenceSync(body.phoneNumberId, body.retry === true)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start history sync." }, { status: 502 }); }
}
