import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: September 2026</p>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-700">
        <p>
          Hanif CRM helps businesses connect WhatsApp Business accounts and
          manage customer conversations.
        </p>
        <p>
          When you connect WhatsApp, we receive access tokens and WhatsApp
          Business identifiers needed to send and receive messages on your
          behalf through Meta’s WhatsApp Cloud API.
        </p>
        <p>
          Message content is processed only to display conversations in your
          CRM inbox and to send replies you initiate. We do not sell your data
          or use WhatsApp data for advertising.
        </p>
        <p>
          Authentication uses Facebook Login for Business / WhatsApp Embedded
          Signup provided by Meta.
        </p>
        <p>
          For questions, contact the app administrator through your Meta app
          listing or support email.
        </p>
      </div>

      <Link href="/" className="mt-8 inline-block text-sm text-green-700 underline">
        ← Back to Home
      </Link>
    </div>
  );
}
