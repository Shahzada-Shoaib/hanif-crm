import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getCredentials, listConnections } from "@/lib/connections";
import { importAccount, MetaError } from "@/lib/meta";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request); if (denied) return denied;
  return NextResponse.json({ connections: listConnections() }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request); if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    let wabaId: string, token: string;
    if (body.action === "sync") {
      const saved = typeof body.phoneNumberId === "string" ? getCredentials(body.phoneNumberId) : null;
      if (!saved) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
      wabaId = saved.wabaId; token = saved.accessToken;
    } else {
      wabaId = typeof body.wabaId === "string" ? body.wabaId.trim() : "";
      token = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
      if (!/^\d+$/.test(wabaId) || !token || token.length > 8192) return NextResponse.json({ error: "A valid WABA ID and access token are required." }, { status: 400 });
    }
    const result = await importAccount(wabaId, token);
    return NextResponse.json({ ok: true, ...result, connections: listConnections() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof MetaError ? error.message : "Could not import account. Check WABA ID, token access and CRM_ENCRYPTION_KEY configuration." }, { status: 502 });
  }
}
