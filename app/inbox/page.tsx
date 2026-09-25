import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, validSession } from "@/lib/auth";
import { listConnections } from "@/lib/connections";
import Inbox from "../components/Inbox";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function InboxPage() {
  if (!validSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/login");
  return <Inbox initialConnections={listConnections()} />;
}
