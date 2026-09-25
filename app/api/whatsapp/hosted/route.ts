import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { hostedSettings, reconcileHosted } from "@/lib/hosted-onboarding";
import { listConnections } from "@/lib/connections";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request); if (denied) return denied;
  return NextResponse.json(hostedSettings(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request); if (denied) return denied;
  const body = await request.json().catch(() => null);
  await reconcileHosted(body?.retry === true);
  return NextResponse.json({ ...hostedSettings(), connections: listConnections() }, { headers: { "Cache-Control": "no-store" } });
}
