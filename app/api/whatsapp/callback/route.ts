import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const base = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${base}/?whatsapp=error`);
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri =
    process.env.META_REDIRECT_URI || `${base}/api/whatsapp/callback`;

  if (!appId || !appSecret) {
    console.error("META_APP_ID or META_APP_SECRET missing");
    return NextResponse.redirect(`${base}/?whatsapp=error`);
  }

  try {
    // 1) Code -> Access Token Exchange
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      return NextResponse.redirect(`${base}/?whatsapp=error`);
    }

    const accessToken = tokenData.access_token;

    // 2) Debug Token -> Shared WABA & Phone Number Details Extract Karna
    const debugUrl = new URL("https://graph.facebook.com/v21.0/debug_token");
    debugUrl.searchParams.set("input_token", accessToken);
    debugUrl.searchParams.set("access_token", `${appId}|${appSecret}`); // App Access Token

    const debugRes = await fetch(debugUrl);
    const debugData = await debugRes.json();

    const targetIds = debugData.data?.granular_scopes;
    const wabaScope = targetIds?.find(
      (scope: any) => scope.scope === "whatsapp_business_management"
    );
    const wabaId = wabaScope?.target_ids?.[0]; // Shared WABA ID

    // Testing Logs (Aap ke terminal mein sab details show hongi)
    console.log("--- WhatsApp Embedded Signup Success ---");
    console.log("Access Token:", accessToken);
    console.log("WABA ID:", wabaId);
    console.log("Full Debug Info:", debugData.data);

    // Baad mein yahan DB Save ka logic aayega (wabaId + accessToken)

    return NextResponse.redirect(`${base}/?whatsapp=connected`);
  } catch (err) {
    console.error("WhatsApp Callback Error:", err);
    return NextResponse.redirect(`${base}/?whatsapp=error`);
  }
}