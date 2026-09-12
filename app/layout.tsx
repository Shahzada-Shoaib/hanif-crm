import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hanif CRM",
  description:
    "Connect WhatsApp Business and manage customer conversations in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <header className="border-b border-gray-200 px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <a href="/" className="text-lg font-semibold tracking-tight">
              Hanif CRM
            </a>
            <nav className="flex gap-4 text-sm text-gray-600">
              <a href="/inbox" className="hover:text-gray-900">
                Inbox
              </a>
              <a href="/privacy" className="hover:text-gray-900">
                Privacy
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-200 px-6 py-4 text-center text-xs text-gray-500">
          Hanif CRM · WhatsApp business messaging for teams ·{" "}
          <a href="/privacy" className="underline">
            Privacy Policy
          </a>
        </footer>
      </body>
    </html>
  );
}
