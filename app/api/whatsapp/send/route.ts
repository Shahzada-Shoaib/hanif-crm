import { NextRequest, NextResponse } from "next/server";
import { addMessage } from "@/lib/messages";
import { getCredentials } from "@/lib/connections";
import { requireAdmin } from "@/lib/auth";
import { graph, MetaError } from "@/lib/meta";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request); if (denied) return denied;
  const body = await request.json().catch(() => null);
  const phoneNumberId = typeof body?.phoneNumberId === "string" ? body.phoneNumberId : "";
  const to = typeof body?.to === "string" ? body.to.replace(/\D/g, "") : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!/^\d+$/.test(phoneNumberId) || !/^\d{7,15}$/.test(to) || !text || text.length > 4096) {
    return NextResponse.json({ ok: false, error: "Select a linked number, enter a valid international recipient and 1–4096 characters." }, { status: 400 });
  }
  try {
    const connection = getCredentials(phoneNumberId);
    if (!connection) return NextResponse.json({ ok: false, error: "This number is not linked. Import or connect it first." }, { status: 404 });
    const data = await graph<{ messages?: { id: string }[] }>(`${phoneNumberId}/messages`, connection.accessToken, {
      method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
    const id = data.messages?.[0]?.id;
    if (!id) return NextResponse.json({ ok: false, error: "Meta did not return a message ID. Check WhatsApp before retrying." }, { status: 502 });
    const message = { id, phoneNumberId, from: phoneNumberId, to, text, direction: "out" as const, timestamp: Date.now() };
    try { addMessage(message); }
    catch {
      return NextResponse.json({ ok: true, message, warning: "Meta accepted the message, but it could not be saved locally. Do not resend; check database storage." });
    }
    return NextResponse.json({ ok: true, message });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof MetaError ? error.message : "Could not read this connection. Check the server encryption key and database." }, { status: 502 });
  }
}
