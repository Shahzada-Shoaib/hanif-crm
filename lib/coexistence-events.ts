import { createHash } from "node:crypto";
import { db } from "./db";
import { addMessage } from "./messages";
import { array, object, parseMessage, phone, string } from "./whatsapp-payload";

// Caller verifies Meta's signature. Persist and process each delivery atomically.
export function ingestWhatsApp(body: unknown) {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const rawEntry of array(object(body).entry)) {
      const entry = object(rawEntry);
      for (const rawChange of array(entry.changes)) {
        const change = object(rawChange), value = object(change.value);
        const field = string(change.field) || (Array.isArray(value.messages) ? "messages" : "");
        if (field === "account_update") {
          const wabaId = string(object(value.waba_info).waba_id) || string(entry.id);
          if (!/^\d+$/.test(wabaId)) continue;
          const payload = JSON.stringify({ waba_id: wabaId, value });
          const hash = createHash("sha256").update(payload).digest("hex");
          database.prepare("INSERT OR IGNORE INTO account_updates VALUES (?, ?, ?, ?)")
            .run(hash, wabaId, payload, Date.now());
          if (value.event === "PARTNER_ADDED") {
            database.prepare("INSERT OR IGNORE INTO hosted_onboarding VALUES (?, 'pending', NULL, ?)").run(wabaId, Date.now());
          }
          continue;
        }
        const metadata = object(value.metadata);
        const id = string(metadata.phone_number_id);
        if (!/^\d+$/.test(id)) continue;
        if (!["messages", "history", "smb_message_echoes", "smb_app_state_sync"].includes(field)) continue;
        const businessPhone = phone(metadata.display_phone_number);
        if (field !== "messages") {
          const payload = JSON.stringify({ field, value });
          const hash = createHash("sha256").update(payload).digest("hex");
          const saved = database.prepare("INSERT OR IGNORE INTO coexistence_events VALUES (?, ?, ?, ?, ?)")
            .run(hash, id, field, payload, Date.now());
          if (!saved.changes) continue;
        }
        if (field === "history") {
          for (const rawChunk of array(value.history)) {
            const chunk = object(rawChunk), meta = object(chunk.metadata);
            const errors = array(chunk.errors).map(error => {
              const code = object(error).code;
              return Number(code) === 2593109 ? "History sharing is disabled in WhatsApp Business."
                : `Meta reported a history error${typeof code === "number" ? ` (${code})` : ""}.`;
            });
            const progress = Math.min(100, Math.max(0, Number(meta.progress) || 0));
            database.prepare(`INSERT INTO history_progress VALUES (?, ?, ?, ?)
              ON CONFLICT(phone_number_id) DO UPDATE SET progress=MAX(progress, excluded.progress),
              error=COALESCE(excluded.error, error), updated_at=excluded.updated_at`)
              .run(id, progress, errors.join(" ") || null, Date.now());
            for (const rawThread of array(chunk.threads)) {
              const thread = object(rawThread);
              for (const rawMessage of array(thread.messages)) {
                const message = parseMessage(rawMessage, id, businessPhone, "history", phone(thread.id));
                if (!message) continue;
                addMessage(message);
                database.prepare("INSERT OR IGNORE INTO history_messages VALUES (?, ?)").run(id, message.id);
              }
            }
          }
        } else if (field === "smb_app_state_sync") {
          for (const rawState of array(value.state_sync)) {
            const state = object(rawState), contact = object(state.contact);
            const contactId = phone(contact.phone_number);
            const timestamp = Number(object(state.metadata).timestamp) * 1000;
            if (state.type !== "contact" || !contactId || !Number.isSafeInteger(timestamp) || timestamp <= 0) continue;
            // A blank name is a tombstone, preventing an older chunk from reviving a deleted contact.
            const name = ["remove", "delete"].includes(string(state.action)) ? "" : string(contact.full_name) || string(contact.first_name);
            database.prepare(`INSERT INTO contacts VALUES (?, ?, ?, ?)
              ON CONFLICT(phone_number_id, contact_id) DO UPDATE SET name=excluded.name,
              timestamp=excluded.timestamp WHERE excluded.timestamp >= contacts.timestamp`)
              .run(id, contactId, name, timestamp);
          }
        } else {
          const messages = field === "smb_message_echoes" ? value.message_echoes : value.messages;
          for (const rawMessage of array(messages)) {
            const message = parseMessage(rawMessage, id, businessPhone, field as "messages" | "smb_message_echoes");
            if (message) addMessage(message);
          }
        }
      }
    }
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

export function getContacts(phoneNumberId: string): Record<string, string> {
  return Object.fromEntries(db().prepare("SELECT contact_id, name FROM contacts WHERE phone_number_id = ? AND name <> ''")
    .all(phoneNumberId).map(row => [String(row.contact_id), String(row.name)]));
}

export function historyStatus(phoneNumberId: string) {
  const database = db();
  const progress = database.prepare("SELECT * FROM history_progress WHERE phone_number_id = ?").get(phoneNumberId);
  const request = database.prepare("SELECT * FROM coexistence_requests WHERE phone_number_id = ? AND kind = 'history'").get(phoneNumberId);
  const count = database.prepare("SELECT COUNT(*) AS count FROM history_messages WHERE phone_number_id = ?").get(phoneNumberId);
  const contacts = database.prepare("SELECT status, error FROM coexistence_requests WHERE phone_number_id = ? AND kind = 'smb_app_state_sync'").get(phoneNumberId);
  return { status: progress ? "receiving" : String(request?.status || "not_started"),
    progress: Number(progress?.progress || 0), count: Number(count?.count || 0),
    contactError: contacts?.error ? String(contacts.error) : null,
    contactStatus: String(contacts?.status || "not_started"),
    error: progress?.error ? String(progress.error) : request?.error ? String(request.error) : null };
}
