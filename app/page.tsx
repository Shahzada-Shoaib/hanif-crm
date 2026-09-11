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
  const {
    whatsapp,
    waba_id,
    phone_number_id,
    display_phone,
    verified_name,
  } = await searchParams;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-3xl font-bold">Hello Hanif CRM</h1>
      <p className="mt-2 text-gray-600">
        Test number inbox + coexistence connect (later)
      </p>
      <a href="/inbox" className="mt-3 inline-block text-green-700 underline">
        Open Inbox
      </a>

      {whatsapp === "connected" && (
        <div className="mt-4 rounded border border-green-300 bg-green-50 p-4 text-green-800">
          <p className="font-bold">WhatsApp Connected Successfully!</p>
          <ul className="mt-2 space-y-1 text-sm">
            {waba_id && <li>WABA ID: {waba_id}</li>}
            {phone_number_id && <li>Phone Number ID: {phone_number_id}</li>}
            {display_phone && <li>Display Phone: {display_phone}</li>}
            {verified_name && <li>Verified Name: {verified_name}</li>}
          </ul>
          <p className="mt-2 text-xs text-green-700">
            Token / IDs terminal mein bhi logged hain. Next: webhook + inbox UI.
          </p>
        </div>
      )}

      {whatsapp === "incomplete" && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <p className="font-bold">Meta login OK — WhatsApp number linked nahi</p>
          <p className="mt-2 text-sm">
            Token mil gaya lekin WABA ID null hai. Matlab sirf permissions allow
            hui; Business App / phone / OTP step complete nahi hua.
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>Meta Business → Integrations → CRM App → Remove</li>
            <li>
              Config ID coexistence / Business App onboarding wala hona chahiye
            </li>
            <li>
              Dubara connect karke QR / Business App flow end tak complete karo
            </li>
          </ul>
        </div>
      )}

      {whatsapp === "error" && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-4 text-red-800">
          <p className="font-bold">WhatsApp connection failed</p>
          <p className="mt-1 text-sm">Terminal logs check karo.</p>
        </div>
      )}

      <ConnectWhatsAppButton />
    </div>
  );
}
