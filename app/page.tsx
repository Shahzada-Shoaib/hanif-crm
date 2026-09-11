export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ whatsapp?: string }>;
}) {
  const { whatsapp } = await searchParams;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Hello Hanif CRM</h1>

      {whatsapp === "connected" && (
        <p className="mt-4 text-green-600">WhatsApp Connected Successfully!</p>
      )}
      {whatsapp === "error" && (
        <p className="mt-4 text-red-600">WhatsApp connection failed.</p>
      )}
    </div>
  );
}
