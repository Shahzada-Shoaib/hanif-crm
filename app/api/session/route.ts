import { NextRequest, NextResponse } from "next/server";
import { createSession, safeEqual, sameOrigin, SESSION_COOKIE } from "@/lib/auth";

// Shared admin workspace. A customer SaaS deployment needs tenant/user membership instead.
let failedAttempts = 0;
let retryAfter = 0;
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin not allowed." }, { status: 403 });
  const password = process.env.CRM_ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.json({ error: "Set CRM_ADMIN_PASSWORD in .env.local, then restart." }, { status: 503 });
  }
  if (Date.now() < retryAfter) return NextResponse.json({ error: "Too many attempts. Try again in one minute." }, { status: 429 });
  const body = await request.json().catch(() => null);
  if (typeof body?.password !== "string" || !safeEqual(body.password, password)) {
    failedAttempts++;
    if (failedAttempts >= 5) { retryAfter = Date.now() + 60_000; failedAttempts = 0; }
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  try {
    const session = createSession();
    failedAttempts = 0;
    const response = NextResponse.json({ ok: true });
    // Origin has already been validated; match the browser's actual protocol.
    response.cookies.set(SESSION_COOKIE, session, { httpOnly: true, sameSite: "lax", secure: request.headers.get("origin")!.startsWith("https:"), path: "/", maxAge: 43200 });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not create a login session. Please restart the server and try again." }, { status: 503 });
  }
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin not allowed." }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
