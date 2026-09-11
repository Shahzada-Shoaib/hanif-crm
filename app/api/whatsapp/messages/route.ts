import { NextResponse } from "next/server";
import { getMessages } from "@/lib/messages";

export async function GET() {
  return NextResponse.json({ messages: getMessages() });
}
