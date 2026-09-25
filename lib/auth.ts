import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "crm_session";
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function createSession() {
  const password = process.env.CRM_ADMIN_PASSWORD;
  if (!password) throw new Error("CRM_ADMIN_PASSWORD is not configured.");
  const expires = String(Date.now() + 12 * 60 * 60 * 1000);
  const signature = createHmac("sha256", password).update(`crm-session:${expires}`).digest("hex");
  return `${expires}.${signature}`;
}
export function validSession(value?: string) {
  if (!value || !process.env.CRM_ADMIN_PASSWORD) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || !Number.isFinite(Number(expires)) || Number(expires) <= Date.now()) return false;
  try {
    const expected = createHmac("sha256", process.env.CRM_ADMIN_PASSWORD).update(`crm-session:${expires}`).digest("hex");
    return safeEqual(expected, signature);
  } catch { return false; }
}
export function appOrigin(request: NextRequest) {
  return new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  // Allow whichever address serves the CRM (localhost, LAN, or a deployment).
  // Also allow the configured public origin when a tunnel uses an internal URL.
  // Do not trust arbitrary Origin/forwarded headers as an allowlist.
  if (!origin || origin === "null") return false;
  if (origin === appOrigin(request)) return true;
  try {
    const browser = new URL(origin);
    const target = new URL(request.url);
    if (browser.origin !== origin) return false;
    // NextRequest normalizes loopback addresses (including 127.0.0.1) to localhost.
    const normalizeHost = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host) ? "localhost" : host;
    return browser.protocol === target.protocol && browser.port === target.port &&
      normalizeHost(browser.hostname) === normalizeHost(target.hostname);
  } catch { return false; }
}
export function requireAdmin(request: NextRequest) {
  if (!validSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Please sign in to the CRM.", ok: false }, { status: 401 });
  }
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request)) {
    return NextResponse.json({ error: "Request origin not allowed.", ok: false }, { status: 403 });
  }
  return null;
}
