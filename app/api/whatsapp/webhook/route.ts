import { createHmac } from "node:crypto";

import { after, NextRequest, NextResponse } from "next/server";

import { safeEqual } from "@/lib/auth";
import { ingestWhatsApp } from "@/lib/coexistence-events";
import { hostedToken, reconcileHosted } from "@/lib/hosted-onboarding";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  console.log("🔥 META GET WEBHOOK HIT");

  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  const params = request.nextUrl.searchParams;

  const mode = params.get("hub.mode");
  const verifyToken = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (
    token &&
    mode === "subscribe" &&
    verifyToken === token &&
    challenge
  ) {
    console.log("✅ META WEBHOOK VERIFIED");

    return new NextResponse(challenge);
  }

  console.log("❌ META WEBHOOK VERIFICATION FAILED");

  return NextResponse.json(
    { error: "Verification failed" },
    { status: 403 }
  );
}

export async function POST(request: NextRequest) {
  console.log("🔥 META POST WEBHOOK HIT");

  const secret = process.env.META_APP_SECRET;

  if (!secret) {
    console.error("❌ META_APP_SECRET is missing");

    return NextResponse.json(
      { error: "Webhook signing is not configured." },
      { status: 503 }
    );
  }

  // IMPORTANT:
  // Read raw body first because Meta's signature is calculated
  // against the exact raw request body.
  const raw = await request.text();

  console.log("📦 META WEBHOOK BODY:");
  console.log(raw);

  // --------------------------------------------------
  // 1. Verify Meta signature
  // --------------------------------------------------

  const signature =
    request.headers.get("x-hub-signature-256") || "";

  const expected =
    "sha256=" +
    createHmac("sha256", secret)
      .update(raw)
      .digest("hex");

  if (!safeEqual(signature, expected)) {
    console.error("❌ INVALID META WEBHOOK SIGNATURE");

    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 401 }
    );
  }

  console.log("✅ META SIGNATURE VALID");

  // --------------------------------------------------
  // 2. Parse JSON
  // --------------------------------------------------

  let body: any;

  try {
    body = JSON.parse(raw);
  } catch {
    console.error("❌ INVALID JSON");

    return NextResponse.json(
      { error: "Invalid JSON." },
      { status: 400 }
    );
  }

  // --------------------------------------------------
  // 3. Make sure this is WhatsApp webhook
  // --------------------------------------------------

  if (body?.object !== "whatsapp_business_account") {
    console.log("ℹ️ Ignoring non-WhatsApp webhook");

    return NextResponse.json({
      status: "ignored",
    });
  }

  // --------------------------------------------------
  // 4. Existing webhook ingestion
  // --------------------------------------------------

  try {
    ingestWhatsApp(body);
  } catch (error) {
    console.error("❌ ingestWhatsApp failed:", error);

    return NextResponse.json(
      {
        error: "Could not save webhook. Please retry.",
      },
      { status: 500 }
    );
  }

  // --------------------------------------------------
  // 5. Handle account_update events
  // --------------------------------------------------

  try {
    const entries = Array.isArray(body?.entry)
      ? body.entry
      : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes)
        ? entry.changes
        : [];

      for (const change of changes) {
        if (change?.field !== "account_update") {
          continue;
        }

        const value = change?.value;

        const event = value?.event;

        console.log("📢 ACCOUNT UPDATE EVENT:", event);

        // ------------------------------------------------
        // Hosted Embedded Signup completed / partner added
        // ------------------------------------------------

        if (event === "PARTNER_ADDED") {
          const wabaId =
            value?.waba_info?.waba_id;

          const ownerBusinessId =
            value?.waba_info?.owner_business_id;

          console.log("🎯 PARTNER_ADDED RECEIVED");

          console.log("WABA ID:", wabaId);
          console.log(
            "OWNER BUSINESS ID:",
            ownerBusinessId
          );

          if (!wabaId || !ownerBusinessId) {
            console.error(
              "❌ PARTNER_ADDED missing WABA or business ID"
            );

            continue;
          }

          // TODO:
          // Next step:
          //
          // 1. Generate appsecret_proof
          // 2. Call:
          //
          // POST
          // /{ownerBusinessId}/system_user_access_tokens
          //
          // 3. Get customer business token
          // 4. Call:
          //
          // GET
          // /{wabaId}/phone_numbers
          //
          // 5. Save phone_number_id + phone data
          //    in your CRM database.

          console.log("🚀 Customer WABA ready for onboarding");

          console.log({
            wabaId,
            ownerBusinessId,
          });
        }

        // ------------------------------------------------
        // Other account update events
        // ------------------------------------------------

        if (event === "PARTNER_APP_INSTALLED") {
          console.log(
            "ℹ️ PARTNER_APP_INSTALLED received"
          );

          console.log(
            "WABA:",
            value?.waba_info?.waba_id
          );
        }

        if (event === "MM_LITE_TERMS_SIGNED") {
          console.log(
            "ℹ️ MM_LITE_TERMS_SIGNED received"
          );

          console.log(
            "WABA:",
            value?.waba_info?.waba_id
          );
        }
      }
    }
  } catch (error) {
    // Do not break webhook acknowledgement because of
    // our internal event-processing logic.
    console.error(
      "❌ account_update processing failed:",
      error
    );
  }

  // --------------------------------------------------
  // 6. Existing hosted onboarding reconciliation
  // --------------------------------------------------

  if (hostedToken()) {
    after(async () => {
      try {
        await reconcileHosted();
      } catch (error) {
        console.error(
          "❌ reconcileHosted failed:",
          error
        );
      }
    });
  }

  // --------------------------------------------------
  // 7. Acknowledge Meta
  // --------------------------------------------------

  return NextResponse.json({
    status: "ok",
  });
}