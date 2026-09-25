/* eslint-disable @typescript-eslint/no-require-imports */
const { randomBytes } = require("node:crypto");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const envFile = path.join(root, ".env.local");
let content = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
const additions = [];
for (const [name, bytes] of [["CRM_ENCRYPTION_KEY", 32], ["CRM_ADMIN_PASSWORD", 24]]) {
  // Never overwrite an existing value: changing the key would invalidate stored tokens.
  if (new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`, "m").test(content)) continue;
  if (name === "CRM_ENCRYPTION_KEY" && existsSync(path.join(root, "data", "crm.sqlite"))) {
    throw new Error("A database already exists. Restore its original CRM_ENCRYPTION_KEY rather than generating a new one.");
  }
  additions.push(`${name}=${randomBytes(bytes).toString("hex")}`);
}
if (additions.length) {
  content += `\n# Local CRM workspace credentials. Keep private and back up with the database.\n${additions.join("\n")}\n`;
  writeFileSync(envFile, content, { mode: 0o600 });
}
console.log(additions.length ? "Added missing CRM credentials to .env.local. Values are not printed. Restart the server and use CRM_ADMIN_PASSWORD to sign in." : "CRM credential entries already exist; no values changed.");
