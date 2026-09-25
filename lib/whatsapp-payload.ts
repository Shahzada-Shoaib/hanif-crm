import type { ChatMessage } from "./types";

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
export function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
export function string(value: unknown): string { return typeof value === "string" ? value : ""; }
export function phone(value: unknown): string {
  const text = string(value);
  return /^[+\d\s()-]+$/.test(text) ? text.replace(/\D/g, "") : "";
}

function messageText(message: Record<string, unknown>): string {
  const type = string(message.type) || "Unsupported";
  const content = object(message[type]);
  const interactive = object(message.interactive);
  return string(object(message.text).body) || string(object(message.button).text)
    || string(object(interactive.button_reply).title) || string(object(interactive.list_reply).title)
    || string(content.caption) || string(content.filename) || `[${type} message]`;
}

// History direction comes from the sender, never the delivery/read status.
export function parseMessage(raw: unknown, phoneNumberId: string, businessPhone: string,
  mode: "messages" | "history" | "smb_message_echoes", threadId = ""): ChatMessage | null {
  const message = object(raw);
  const id = string(message.id);
  const from = phone(message.from);
  const timestamp = Number(message.timestamp) * 1000;
  if (!id || !from || !Number.isSafeInteger(timestamp) || timestamp <= 0) return null;
  let direction: "in" | "out" = "in";
  let contact = from;
  if (mode === "smb_message_echoes") {
    direction = "out"; contact = phone(message.to);
  } else if (mode === "history") {
    if (!threadId) return null;
    if (from === threadId) direction = "in";
    else if (from === businessPhone || from === phoneNumberId) direction = "out";
    else return null; // Preserve the raw event rather than assign an ambiguous sender.
    contact = threadId;
  }
  if (!contact) return null;
  return { id, phoneNumberId, from: direction === "in" ? contact : phoneNumberId,
    to: direction === "in" ? phoneNumberId : contact, direction, timestamp, text: messageText(message) };
}
