import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/lib/messages";
import { getConnection } from "@/lib/connections";
import { requireAdmin } from "@/lib/auth";
import { getContacts } from "@/lib/coexistence-events";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request); if (denied) return denied;
  const phoneNumberId = request.nextUrl.searchParams.get("phoneNumberId");
  if (!phoneNumberId) return NextResponse.json({ error: "phoneNumberId is required." }, { status: 400 });
  if (!getConnection(phoneNumberId)) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
  return NextResponse.json({ messages: getMessages(phoneNumberId), contacts: getContacts(phoneNumberId) }, { headers: { "Cache-Control": "no-store" } });
}
