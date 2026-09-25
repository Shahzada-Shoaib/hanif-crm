import { db } from "./db";
import type { ChatMessage } from "./types";
export type { ChatMessage } from "./types";

export function getMessages(phoneNumberId: string): ChatMessage[] {
  return db().prepare("SELECT * FROM messages WHERE phone_number_id = ? ORDER BY timestamp, id").all(phoneNumberId).map((row) => ({
    id: String(row.id), phoneNumberId: String(row.phone_number_id), from: String(row.sender),
    to: String(row.recipient), text: String(row.body), direction: row.direction as "in" | "out",
    timestamp: Number(row.timestamp),
  }));
}

export function addMessage(message: ChatMessage) {
  db().prepare(`INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(phone_number_id, id) DO UPDATE SET body=excluded.body
    WHERE messages.body = '[media_placeholder message]' AND excluded.body <> '[media_placeholder message]'`).run(
    message.id, message.phoneNumberId, message.from, message.to, message.text, message.direction, message.timestamp,
  );
}
