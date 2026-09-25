import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
let database: DatabaseSync | undefined;
export function db() {
  if (database) return database;
  const dir = process.env.CRM_DATA_DIR || path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const opened = new DatabaseSync(path.join(dir, "crm.sqlite"));
  opened.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS connections (
      phone_number_id TEXT PRIMARY KEY, waba_id TEXT NOT NULL,
      display_phone TEXT NOT NULL, verified_name TEXT NOT NULL,
      encrypted_token TEXT NOT NULL, webhook_subscribed INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT NOT NULL, phone_number_id TEXT NOT NULL, sender TEXT NOT NULL,
      recipient TEXT NOT NULL, body TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('in','out')), timestamp INTEGER NOT NULL,
      PRIMARY KEY(phone_number_id, id)
    );
    CREATE INDEX IF NOT EXISTS messages_phone_time ON messages(phone_number_id, timestamp);
    CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS account_updates (
      event_hash TEXT PRIMARY KEY, waba_id TEXT NOT NULL,
      payload TEXT NOT NULL, received_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coexistence_events (
      hash TEXT PRIMARY KEY, phone_number_id TEXT NOT NULL, field TEXT NOT NULL,
      payload TEXT NOT NULL, received_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS history_messages (
      phone_number_id TEXT NOT NULL, message_id TEXT NOT NULL,
      PRIMARY KEY(phone_number_id, message_id)
    );
    CREATE TABLE IF NOT EXISTS history_progress (
      phone_number_id TEXT PRIMARY KEY, progress INTEGER NOT NULL DEFAULT 0,
      error TEXT, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contacts (
      phone_number_id TEXT NOT NULL, contact_id TEXT NOT NULL, name TEXT NOT NULL,
      timestamp INTEGER NOT NULL, PRIMARY KEY(phone_number_id, contact_id)
    );
    CREATE TABLE IF NOT EXISTS coexistence_requests (
      phone_number_id TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL,
      request_id TEXT, error TEXT, updated_at INTEGER NOT NULL,
      PRIMARY KEY(phone_number_id, kind)
    );
    CREATE TABLE IF NOT EXISTS hosted_onboarding (
      waba_id TEXT PRIMARY KEY, status TEXT NOT NULL, error TEXT, updated_at INTEGER NOT NULL
    );
  `);
  // Keep the original file. Unknown business IDs remain archived, never assigned to a different inbox.
  try {
    opened.exec("BEGIN IMMEDIATE");
    if (!opened.prepare("SELECT name FROM migrations WHERE name = ?").get("legacy_messages")) {
      const legacy = path.join(dir, "messages.json");
      if (existsSync(legacy)) {
        const records: unknown = JSON.parse(readFileSync(legacy, "utf8"));
        if (!Array.isArray(records)) throw new Error("Invalid legacy messages.json; migration stopped.");
        const insert = opened.prepare("INSERT OR IGNORE INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)");
        for (const m of records) {
          if (!m || typeof m.id !== "string" || typeof m.from !== "string" || typeof m.to !== "string" ||
              typeof m.text !== "string" || !Number.isFinite(m.timestamp) || !["in", "out"].includes(m.direction)) {
            throw new Error("Invalid legacy message; migration stopped without changing the original file.");
          }
          const phone = m.phoneNumberId || (m.direction === "in" ? m.to : m.from);
          insert.run(m.id, phone, m.from, m.to, m.text, m.direction, m.timestamp);
        }
      }
      opened.prepare("INSERT INTO migrations VALUES (?)").run("legacy_messages");
    }
    opened.exec("COMMIT");
  } catch (error) {
    opened.exec("ROLLBACK");
    opened.close();
    throw error;
  }
  database = opened;
  return database;
}
