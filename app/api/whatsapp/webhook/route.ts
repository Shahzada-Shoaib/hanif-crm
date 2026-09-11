import { NextRequest, NextResponse } from "next/server";
import { addMessage } from "@/lib/messages";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "faheem123";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log("WhatsApp webhook:", JSON.stringify(body, null, 2));

  const entries = body?.entry ?? [];
  for (const entry of entries) {
    const changes = entry?.changes ?? [];
    for (const change of changes) {
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id ?? "";
      const messages = value?.messages ?? [];

      for (const msg of messages) {
        if (msg.type !== "text" || !msg.text?.body) continue;

        addMessage({
          id: msg.id,
          from: msg.from,
          to: phoneNumberId,
          text: msg.text.body,
          direction: "in",
          timestamp: Number(msg.timestamp) * 1000 || Date.now(),
        });
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}
