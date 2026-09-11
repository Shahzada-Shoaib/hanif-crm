import { NextRequest, NextResponse } from "next/server";
import { addMessage } from "@/lib/messages";

export async function POST(request: NextRequest) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    return NextResponse.json(
      { ok: false, error: "WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN missing" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const to = String(body?.to || "").replace(/\D/g, "");
  const text = String(body?.text || "").trim();

  if (!to || !text) {
    return NextResponse.json({ ok: false, error: "to and text required" }, { status: 400 });
  }

  const res = await fetch(
    `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    console.error("Send failed:", data);
    return NextResponse.json(
      { ok: false, error: data?.error?.message || "Send failed" },
      { status: 400 }
    );
  }

  addMessage({
    id: data.messages?.[0]?.id || `out-${Date.now()}`,
    from: phoneNumberId,
    to,
    text,
    direction: "out",
    timestamp: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
