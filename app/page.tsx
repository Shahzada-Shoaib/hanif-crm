import Link from "next/link";

export default function Home() {
  return <div className="mx-auto max-w-2xl px-6 py-12">
    <h1 className="text-3xl font-bold tracking-tight">Hanif CRM</h1>
    <p className="mt-3 text-gray-600">Manage multiple WhatsApp business numbers from one workspace. Each number has its own customer conversations and replies.</p>
    <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-gray-700">
      <li>Sign in to your workspace.</li>
      <li>Open Meta onboarding and connect your WhatsApp Business app.</li>
      <li>Select a linked number, open a customer chat and reply.</li>
    </ol>
    <Link href="/inbox" className="mt-6 inline-block rounded-lg bg-green-700 px-5 py-3 font-semibold text-white">Open workspace</Link>
  </div>;
}
