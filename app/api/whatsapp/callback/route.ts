import { NextRequest, NextResponse } from "next/server";

type PhoneInfo = {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
};

type ExchangeResult = {
  accessToken: string;
  wabaId: string | null;
  phoneNumberId: string | null;
  displayPhone: string | null;
  verifiedName: string | null;
  scopes: string[];
};

function appBase(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const host = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

function redirectUriForExchange(request: NextRequest) {
  const fromEnv = process.env.META_REDIRECT_URI;
  if (fromEnv) return fromEnv;
  const base = appBase(request);
  return `${base.replace(/\/$/, "")}/api/whatsapp/callback`;
}

async function exchangeCode(
  code: string,
  redirectUri: string,
  appId: string,
  appSecret: string
) {
  const url = new URL("https://graph.facebook.com/v22.0/oauth/access_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  console.log("Token exchange with redirect_uri:", redirectUri);

  const res = await fetch(url.toString());
  const data = await res.json();
  return { ok: res.ok && !!data.access_token, data };
}

async function debugToken(accessToken: string, appId: string, appSecret: string) {
  const url = new URL("https://graph.facebook.com/v22.0/debug_token");
  url.searchParams.set("input_token", accessToken);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);
  const res = await fetch(url.toString());
  return res.json();
}

function pickWabaId(debugData: {
  data?: {
    granular_scopes?: { scope: string; target_ids?: string[] }[];
  };
}): string | null {
  const scopes = debugData.data?.granular_scopes ?? [];
  for (const key of [
    "whatsapp_business_management",
    "whatsapp_business_messaging",
  ]) {
    const match = scopes.find((s) => s.scope === key);
    if (match?.target_ids?.[0]) return match.target_ids[0];
  }
  return null;
}

async function fetchPhoneNumbers(
  wabaId: string,
  accessToken: string
): Promise<PhoneInfo[]> {
  const url = new URL(
    `https://graph.facebook.com/v22.0/${wabaId}/phone_numbers`
  );
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok) {
    console.error("phone_numbers fetch failed:", data);
    return [];
  }

  return (data.data ?? []) as PhoneInfo[];
}

/** Subscribe app to WABA webhooks (required for incoming messages) */
async function subscribeWaba(wabaId: string, accessToken: string) {
  const url = new URL(
    `https://graph.facebook.com/v22.0/${wabaId}/subscribed_apps`
  );
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  console.log("WABA subscribed_apps:", data);
  return { ok: res.ok, data };
}

async function handleExchange(
  code: string,
  redirectUri: string
): Promise<ExchangeResult> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID or META_APP_SECRET missing");
  }

  const exchanged = await exchangeCode(code, redirectUri, appId, appSecret);
  if (!exchanged.ok) {
    console.error("Token exchange failed:", exchanged.data);
    throw new Error(exchanged.data?.error?.message || "Token exchange failed");
  }

  const accessToken = exchanged.data.access_token as string;
  const debugData = await debugToken(accessToken, appId, appSecret);
  const wabaId = pickWabaId(debugData);
  const scopes = (debugData.data?.scopes as string[]) ?? [];

  let phoneNumberId: string | null = null;
  let displayPhone: string | null = null;
  let verifiedName: string | null = null;

  if (wabaId) {
    const phones = await fetchPhoneNumbers(wabaId, accessToken);
    console.log("WABA phone numbers:", phones);

    if (phones[0]) {
      phoneNumberId = phones[0].id;
      displayPhone = phones[0].display_phone_number ?? null;
      verifiedName = phones[0].verified_name ?? null;
    }

    // Best-effort webhook subscribe so messages can arrive later
    await subscribeWaba(wabaId, accessToken);
  }

  console.log("--- WhatsApp Coexistence / Embedded Signup Result ---");
  console.log("Access Token:", accessToken);
  console.log("WABA ID:", wabaId);
  console.log("Phone Number ID:", phoneNumberId);
  console.log("Display Phone:", displayPhone);
  console.log("Verified Name:", verifiedName);
  console.log("Scopes:", scopes);
  console.log("Full Debug Info:", debugData.data);

  // Testing: later replace with DB save (token, wabaId, phoneNumberId)
  return {
    accessToken,
    wabaId,
    phoneNumberId,
    displayPhone,
    verifiedName,
    scopes,
  };
}

function buildHomeRedirect(
  base: string,
  status: "connected" | "incomplete" | "error",
  result?: Partial<ExchangeResult>
) {
  const url = new URL(`${base}/`);
  url.searchParams.set("whatsapp", status);
  if (result?.wabaId) url.searchParams.set("waba_id", result.wabaId);
  if (result?.phoneNumberId)
    url.searchParams.set("phone_number_id", result.phoneNumberId);
  if (result?.displayPhone)
    url.searchParams.set("display_phone", result.displayPhone);
  if (result?.verifiedName)
    url.searchParams.set("verified_name", result.verifiedName);
  return NextResponse.redirect(url.toString());
}

/** Browser redirect from Meta dialog/oauth lands here */
export async function GET(request: NextRequest) {
  const base = appBase(request);
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const errorDesc = request.nextUrl.searchParams.get("error_description");

  if (error) {
    console.error("OAuth error from Meta:", error, errorDesc);
    return buildHomeRedirect(base, "error");
  }

  if (!code) {
    return buildHomeRedirect(base, "error");
  }

  const redirectUri = redirectUriForExchange(request);

  try {
    const result = await handleExchange(code, redirectUri);

    // Token alone is NOT enough — WABA/phone must be linked
    if (!result.wabaId) {
      console.warn(
        "Token OK but no WABA ID — coexistence / Embedded Signup incomplete"
      );
      return buildHomeRedirect(base, "incomplete", result);
    }

    return buildHomeRedirect(base, "connected", result);
  } catch (err) {
    console.error("WhatsApp Callback Error:", err);
    return buildHomeRedirect(base, "error");
  }
}

/** Optional JSON API (kept for debugging) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = body?.code as string | undefined;
    const redirectUri =
      (body?.redirect_uri as string | undefined) ||
      redirectUriForExchange(request);

    if (!code) {
      return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
    }

    const result = await handleExchange(code, redirectUri);
    const ok = !!result.wabaId;

    return NextResponse.json({
      ok,
      status: ok ? "connected" : "incomplete",
      wabaId: result.wabaId,
      phoneNumberId: result.phoneNumberId,
      displayPhone: result.displayPhone,
      verifiedName: result.verifiedName,
    });
  } catch (err) {
    console.error("WhatsApp Callback Error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    );
  }
}
