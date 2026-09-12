"use client";

import { useState } from "react";

/**
 * Embedded Signup — Coexistence flow
 * Links an existing WhatsApp Business App number to Cloud API.
 */
export default function ConnectWhatsAppButton() {
  const [busy, setBusy] = useState(false);

  const handleLaunchSignup = () => {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;

    if (!appId || !configId) {
      alert("WhatsApp connection is not configured yet. Please contact support.");
      return;
    }

    setBusy(true);

    const redirectUri = `${window.location.origin}/api/whatsapp/callback`;
    const state = crypto.randomUUID();
    sessionStorage.setItem("wa_oauth_state", state);

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

    window.location.href = url.toString();
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleLaunchSignup}
        disabled={busy}
        className="rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {busy ? "Opening Meta…" : "Connect WhatsApp Business"}
      </button>
      <p className="mt-3 max-w-md text-sm text-gray-600">
        You’ll be redirected to Meta to securely link your WhatsApp Business
        account. You can keep using the WhatsApp Business app after connecting.
      </p>
    </div>
  );
}
