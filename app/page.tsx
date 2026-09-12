import ConnectWhatsAppButton from "./components/ConnectWhatsAppButton";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    whatsapp?: string;
    waba_id?: string;
    phone_number_id?: string;
    display_phone?: string;
    verified_name?: string;
  }>;
}) {
  const { whatsapp, display_phone, verified_name } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Hanif CRM</h1>
      <p className="mt-3 text-gray-600">
        Connect your WhatsApp Business number and manage customer chats from one
        inbox.
      </p>

      <ol className="mt-6 list-decimal space-y-1 pl-5 text-sm text-gray-700">
        <li>Connect WhatsApp Business</li>
        <li>Open Inbox to view conversations</li>
        <li>Reply to customers from the CRM</li>
      </ol>

      {whatsapp === "connected" && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
          <p className="font-semibold">WhatsApp connected successfully</p>
          {(verified_name || display_phone) && (
            <p className="mt-1 text-sm">
              {verified_name}
              {verified_name && display_phone ? " · " : ""}
              {display_phone}
            </p>
          )}
          <a
            href="/inbox"
            className="mt-3 inline-block text-sm font-medium text-green-800 underline"
          >
            Open Inbox
          </a>
        </div>
      )}

      {whatsapp === "incomplete" && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="font-semibold">Connection incomplete</p>
          <p className="mt-1 text-sm">
            Login succeeded, but a WhatsApp Business number was not linked.
            Please try connecting again and complete all onboarding steps.
          </p>
        </div>
      )}

      {whatsapp === "error" && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="font-semibold">Couldn’t connect WhatsApp</p>
          <p className="mt-1 text-sm">Please try again in a few moments.</p>
        </div>
      )}

      <div className="mt-8">
        <ConnectWhatsAppButton />
      </div>

      <p className="mt-8 text-sm text-gray-500">
        Already connected?{" "}
        <a href="/inbox" className="text-green-700 underline">
          Go to Inbox
        </a>
      </p>
    </div>
  );
}
