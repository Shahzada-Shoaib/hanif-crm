"use client";

import { useState } from "react";

/**
 * Embedded Signup — Coexistence flow
 * Purana WhatsApp Business App number Cloud API ke sath link karta hai.
 * Meta config mein coexistence / Business App onboarding enabled hona chahiye.
 */
export default function ConnectWhatsAppButton() {
  const [busy, setBusy] = useState(false);

  const handleLaunchSignup = () => {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;

    if (!appId || !configId) {
      alert("Missing NEXT_PUBLIC_META_APP_ID or NEXT_PUBLIC_META_CONFIG_ID");
      return;
    }

    setBusy(true);

    // Must match Meta Valid OAuth Redirect URIs exactly
    const redirectUri = `${window.location.origin}/api/whatsapp/callback`;
    const state = crypto.randomUUID();
    sessionStorage.setItem("wa_oauth_state", state);

    // Coexistence: featureType triggers WhatsApp Business App onboarding (QR / link)
    const extras = JSON.stringify({
      setup: {},
      sessionInfoVersion: "3",
      featureType: "whatsapp_business_app_onboarding",
    });

    const url = new URL("https://www.facebook.com/v22.0/dialog/oauth");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("config_id", configId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("override_default_response_type", "true");
    url.searchParams.set("state", state);
    url.searchParams.set("extras", extras);

    console.log("Coexistence OAuth redirect_uri:", redirectUri);
    console.log("Config ID:", configId);
    window.location.href = url.toString();
  };

  return (
    <div className="max-w-xl">
      <button
        type="button"
        onClick={handleLaunchSignup}
        disabled={busy}
        className="mt-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded"
      >
        {busy ? "Redirecting to Meta..." : "Connect WhatsApp Business App"}
      </button>

      <p className="mt-3 text-sm text-gray-600">
        Coexistence flow: apna pehle se chal raha WhatsApp Business App number
        Meta pe link hoga (QR / Business App onboarding). Flow end tak complete
        karo — sirf Continue mat dabao.
      </p>
    </div>
  );
}
