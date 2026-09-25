/* eslint-disable @typescript-eslint/no-require-imports */
const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHmac } = require("node:crypto");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hanif-crm-test-"));
process.env.CRM_DATA_DIR = directory;
process.env.CRM_ENCRYPTION_KEY = "ab".repeat(32);
process.env.CRM_ADMIN_PASSWORD = "test-admin-password-only";
process.env.META_APP_SECRET = "test-meta-secret";
process.env.META_APP_ID = "999";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.WHATSAPP_VERIFY_TOKEN = "test-verify";
delete process.env.META_SYSTEM_USER_ACCESS_TOKEN;
delete process.env.WHATSAPP_ACCESS_TOKEN;
fs.writeFileSync(path.join(directory, "messages.json"), JSON.stringify([
  { id: "legacy-a", from: "923001234567", to: "111", text: "legacy inbound", direction: "in", timestamp: 1000 },
  { id: "legacy-b", from: "222", to: "923001234567", text: "legacy outbound", direction: "out", timestamp: 2000 },
]));

// Compile source in memory, using the application's real route and storage modules.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args);
};
Module._extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  module._compile(output.outputText, filename);
};
const { NextRequest } = require("next/server");
const { db } = require("../lib/db.ts");
const { createSession, validSession, sameOrigin } = require("../lib/auth.ts");
const sessionRoute = require("../app/api/session/route.ts");
const { listConnections, saveConnections, getCredentials } = require("../lib/connections.ts");
const { addMessage, getMessages } = require("../lib/messages.ts");
const { importAccount } = require("../lib/meta.ts");
const send = require("../app/api/whatsapp/send/route.ts");
const messages = require("../app/api/whatsapp/messages/route.ts");
const webhook = require("../app/api/whatsapp/webhook/route.ts");
const connections = require("../app/api/whatsapp/connections/route.ts");
const realFetch = global.fetch;
test("account import keeps other linked accounts in the inbox response", async () => {
  saveConnections([connection("611", "661")], "existing-token");
  global.fetch = async url => url.includes("phone_numbers")
    ? json({ data: [{ id: "622" }] }) : json({ success: true });
  const response = await connections.POST(request("/api/whatsapp/connections", { wabaId: "662", accessToken: "new-token" }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.connections.some(item => item.phoneNumberId === "611"));
  assert.ok(data.connections.some(item => item.phoneNumberId === "622"));
  assert.ok(!JSON.stringify(data).includes("new-token"));
  db().prepare("DELETE FROM connections WHERE waba_id IN ('661', '662')").run();
});

test("hosted onboarding exposes only a direct Meta link and public status", async () => {
  const hosted = require("../app/api/whatsapp/hosted/route.ts");
  const previous = process.env.META_HOSTED_CONFIG_ID;
  process.env.META_HOSTED_CONFIG_ID = "3264827733702626";
  try {
    assert.equal((await hosted.GET(request("/api/whatsapp/hosted", undefined, false))).status, 401);
    const response = await hosted.GET(request("/api/whatsapp/hosted"));
    const data = await response.json();
    assert.equal(data.url, "https://business.facebook.com/messaging/whatsapp/onboard/?app_id=999&config_id=3264827733702626");
    assert.ok(!JSON.stringify(data).includes(process.env.META_APP_SECRET));
  } finally {
    if (previous === undefined) delete process.env.META_HOSTED_CONFIG_ID;
    else process.env.META_HOSTED_CONFIG_ID = previous;
  }
});
function request(route, body, auth = true, extraHeaders = {}) {
  return new NextRequest("http://localhost:3000" + route, {
    method: body === undefined ? "GET" : "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json", ...(auth ? { cookie: `crm_session=${createSession()}` } : {}), ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function connection(id, wabaId = "888") {
  return { phoneNumberId: id, wabaId, displayPhone: "+" + id, verifiedName: "Test business", webhookSubscribed: true, updatedAt: Date.now() };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("legacy chats migrate by their own business ID and the original file stays intact", () => {
  assert.equal(getMessages("111")[0].text, "legacy inbound");
  assert.equal(getMessages("222")[0].text, "legacy outbound");
  assert.equal(getMessages("333").length, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, "messages.json"))).length, 2);
});

beforeEach(() => { global.fetch = realFetch; });
test("local and public logins work with a tunnel configured, without allowing foreign origins", async () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://crm.example.com";
  try {
    for (const origin of ["http://localhost:3000", "http://127.0.0.1:3001", "http://192.168.1.10:3000", "https://crm.example.com"]) {
      const req = new NextRequest(origin + "/api/session", {
        method: "POST", headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ password: process.env.CRM_ADMIN_PASSWORD }),
      });
      const response = await sessionRoute.POST(req);
      assert.equal(response.status, 200, origin);
      assert.equal(/; Secure/i.test(response.headers.get("set-cookie")), origin.startsWith("https:"));
    }
    assert.equal(sameOrigin(request("/api/session", {}, false, { origin: "https://crm.example.com" })), true);
    assert.equal((await sessionRoute.POST(request("/api/session", {}, false, { origin: "https://evil.example" }))).status, 403);
    assert.equal(sameOrigin(request("/api/session", {}, false, { origin: "null" })), false);
    assert.equal(sameOrigin(new NextRequest("http://localhost:3000/api/session")), false);
  } finally { process.env.NEXT_PUBLIC_APP_URL = previous; }
});

test("login accepts the configured short password without an encryption key", async () => {
  const previousPassword = process.env.CRM_ADMIN_PASSWORD;
  const previousKey = process.env.CRM_ENCRYPTION_KEY;
  process.env.CRM_ADMIN_PASSWORD = "123456";
  delete process.env.CRM_ENCRYPTION_KEY;
  try {
    const response = await sessionRoute.POST(request("/api/session", { password: "123456" }, false));
    assert.equal(response.status, 200);
    const cookie = response.cookies.get("crm_session").value;
    assert.equal(validSession(cookie), true);
    assert.equal((await sessionRoute.POST(request("/api/session", { password: "wrong" }, false))).status, 401);
    process.env.CRM_ADMIN_PASSWORD = "changed-password";
    assert.equal(validSession(cookie), false);
  } finally {
    process.env.CRM_ADMIN_PASSWORD = previousPassword;
    process.env.CRM_ENCRYPTION_KEY = previousKey;
  }
});

test("tokens are encrypted at rest and excluded from connection responses", async () => {
  saveConnections([connection("111")], "token-one");
  saveConnections([connection("222")], "token-two");
  const stored = db().prepare("SELECT encrypted_token FROM connections WHERE phone_number_id = ?").get("111");
  assert.ok(!stored.encrypted_token.includes("token-one"));
  assert.equal(getCredentials("111").accessToken, "token-one");
  const response = await connections.GET(request("/api/whatsapp/connections"));
  const data = await response.text();
  assert.ok(!data.includes("token-one"));
  assert.ok(!data.includes("encrypted_token"));
  assert.equal(listConnections().length, 2);
});


test("same customer and message IDs remain isolated across business numbers", async () => {
  for (const id of ["111", "222"]) addMessage({ id: "same-message", phoneNumberId: id, from: "923001234567", to: id, text: id, direction: "in", timestamp: 3000 });
  addMessage({ id: "same-message", phoneNumberId: "111", from: "923001234567", to: "111", text: "duplicate", direction: "in", timestamp: 3000 });
  const result = await messages.GET(request("/api/whatsapp/messages?phoneNumberId=111"));
  const data = await result.json();
  assert.ok(data.messages.every((message) => message.phoneNumberId === "111"));
  assert.equal(data.messages.filter((message) => message.id === "same-message").length, 1);
  assert.equal((await messages.GET(request("/api/whatsapp/messages"))).status, 400);
  assert.equal((await messages.GET(request("/api/whatsapp/messages?phoneNumberId=444"))).status, 404);
});

test("sending uses only the selected number and that number's token", async () => {
  global.fetch = async (url, init) => {
    assert.ok(url.endsWith("/222/messages"));
    assert.equal(init.headers.Authorization, "Bearer token-two");
    assert.equal(JSON.parse(init.body).to, "923001234567");
    return json({ messages: [{ id: "sent-b" }] });
  };
  const response = await send.POST(request("/api/whatsapp/send", { phoneNumberId: "222", to: "+923001234567", text: "hello" }));
  assert.equal(response.status, 200);
  assert.ok(getMessages("222").some((message) => message.id === "sent-b"));
  assert.ok(!getMessages("111").some((message) => message.id === "sent-b"));
});

test("unknown numbers, unauthenticated users and cross-origin sends are rejected before Meta", async () => {
  global.fetch = async () => { throw new Error("Must not contact Meta"); };
  const body = { phoneNumberId: "444", to: "923001234567", text: "hello" };
  assert.equal((await send.POST(request("/api/whatsapp/send", body))).status, 404);
  assert.equal((await send.POST(request("/api/whatsapp/send", body, false))).status, 401);
  assert.equal((await send.POST(request("/api/whatsapp/send", body, true, { origin: "https://other.example" }))).status, 403);
  assert.equal((await connections.GET(request("/api/whatsapp/connections", undefined, false))).status, 401);
  assert.equal(validSession("expired.forged"), false);
});

test("Meta token errors do not save a successful outgoing message or leak upstream details", async () => {
  const before = getMessages("111").length;
  global.fetch = async () => json({ error: { code: 190, message: "secret-upstream-payload" } }, 400);
  const response = await send.POST(request("/api/whatsapp/send", { phoneNumberId: "111", to: "923001234567", text: "fail" }));
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.match(body, /190/); assert.ok(!body.includes("secret-upstream-payload"));
  assert.equal(getMessages("111").length, before);
});

test("signed webhook batches route to the correct number and retries deduplicate", async () => {
  const payload = { object: "whatsapp_business_account", entry: [{ changes: ["111", "222"].map((id) => ({ value: { metadata: { phone_number_id: id }, messages: [{ id: "webhook-shared", from: "923009999999", type: "text", text: { body: id }, timestamp: "1700000000" }] } })) }] };
  assert.equal((await webhook.POST(request("/api/whatsapp/webhook", payload, false))).status, 401);
  const signature = "sha256=" + createHmac("sha256", process.env.META_APP_SECRET).update(JSON.stringify(payload)).digest("hex");
  for (let i = 0; i < 2; i++) assert.equal((await webhook.POST(request("/api/whatsapp/webhook", payload, false, { "x-hub-signature-256": signature }))).status, 200);
  for (const id of ["111", "222"]) {
    const records = getMessages(id).filter((message) => message.id === "webhook-shared");
    assert.equal(records.length, 1); assert.equal(records[0].text, id);
  }
});

test("import follows pagination and reconnect updates tokens without duplicating numbers", async () => {
  global.fetch = async (url) => {
    if (url.includes("subscribed_apps")) return json({ success: true });
    if (url.includes("after=")) return json({ data: [{ id: "556", display_phone_number: "+556" }] });
    return json({ data: [{ id: "555", display_phone_number: "+555" }], paging: { next: "not-followed-directly", cursors: { after: "page2" } } });
  };
  const result = await importAccount("777", "new-token");
  assert.equal(result.connections.length, 2);
  await importAccount("777", "rotated-token");
  assert.equal(listConnections().filter((item) => item.wabaId === "777").length, 2);
  assert.equal(getCredentials("556").accessToken, "rotated-token");
});

test("import replaces only the fetched WABA list, including an empty result", async () => {
  saveConnections([connection("555", "777"), connection("556", "777"), connection("900", "999")], "old-token");
  global.fetch = async url => url.includes("subscribed_apps") ? json({ success: true }) : json({ data: [{ id: "556" }] });
  await importAccount("777", "new-token");
  assert.equal(getCredentials("555"), null);
  assert.equal(getCredentials("556").accessToken, "new-token");
  assert.equal(getCredentials("900").accessToken, "old-token");
  global.fetch = async () => json({ data: [] });
  await importAccount("777", "new-token");
  assert.equal(listConnections().filter(c => c.wabaId === "777").length, 0);
  assert.ok(getCredentials("900"));
});

test("a failed later Meta page preserves the previous account list", async () => {
  saveConnections([connection("555", "777")], "old-token");
  global.fetch = async url => url.includes("after=")
    ? json({ error: { code: 190 } }, 401)
    : json({ data: [{ id: "556" }], paging: { next: "next-page", cursors: { after: "page2" } } });
  await assert.rejects(importAccount("777", "new-token"));
  assert.equal(getCredentials("555").accessToken, "old-token");
  assert.equal(getCredentials("556"), null);
});

test("failed webhook subscription is persisted as a warning, not a connected webhook", async () => {
  global.fetch = async (url) => url.includes("subscribed_apps") ? json({ error: { code: 200 } }, 403) : json({ data: [{ id: "557" }] });
  const result = await importAccount("778", "scoped-token");
  assert.ok(result.warning); assert.equal(result.connections[0].webhookSubscribed, false);
});

after(() => {
  global.fetch = realFetch;
  db().close();
  assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith("hanif-crm-test-"));
  fs.rmSync(directory, { recursive: true });
});

test("signed account_update is stored without phone metadata and duplicate deliveries deduplicate", async () => {
  const payload = { object: "whatsapp_business_account", entry: [{ id: "8844", changes: [{ field: "account_update", value: { event: "PARTNER_ADDED", waba_info: { waba_id: "8844", owner_business_id: "55" } } }] }] };
  assert.equal((await webhook.POST(request("/api/whatsapp/webhook", payload, false))).status, 401);
  const signature = "sha256=" + createHmac("sha256", process.env.META_APP_SECRET).update(JSON.stringify(payload)).digest("hex");
  for (let i = 0; i < 2; i++) assert.equal((await webhook.POST(request("/api/whatsapp/webhook", payload, false, { "x-hub-signature-256": signature }))).status, 200);
  const records = db().prepare("SELECT * FROM account_updates WHERE waba_id = ?").all("8844");
  assert.equal(records.length, 1);
  assert.equal(JSON.parse(records[0].payload).value.waba_info.owner_business_id, "55");
});

function coexPayload(field, value, id = "7001") {
  return { object: "whatsapp_business_account", entry: [{ id: "8001", changes: [{ field, value: {
    metadata: { phone_number_id: id, display_phone_number: "+92 300 1111111" }, ...value,
  } }] }] };
}
async function deliver(payload) {
  const signature = "sha256=" + createHmac("sha256", process.env.META_APP_SECRET).update(JSON.stringify(payload)).digest("hex");
  return webhook.POST(request("/api/whatsapp/webhook", payload, false, { "x-hub-signature-256": signature }));
}
function mockSyncFetch({ history, contacts, fields, callbackUrl } = {}) {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("fields=is_on_biz_app")) return json({ is_on_biz_app: true });
    if (url.includes("/subscriptions")) return json({ data: [{ object: "whatsapp_business_account", active: true,
      callback_url: callbackUrl || "http://localhost:3000/api/whatsapp/webhook",
      fields: (fields || ["messages", "history", "smb_app_state_sync", "smb_message_echoes"]).map(name => ({ name })) }] });
    if (url.includes("/subscribed_apps")) return json({ success: true });
    if (url.includes("/smb_app_data")) {
      const kind = JSON.parse(options.body).sync_type;
      const handler = kind === "history" ? history : contacts;
      return handler ? handler() : json({ request_id: "request-" + kind });
    }
    throw new Error("Unexpected Meta request");
  };
  return calls;
}

test("history chunks preserve direction, timestamps, deduplication and number isolation before import", async () => {
  const { historyStatus } = require("../lib/coexistence-events.ts");
  const payload = coexPayload("history", { history: [{ metadata: { phase: 1, chunk_order: 1, progress: 60 }, threads: [{
    id: "923009999999", messages: [
      { id: "old-in", from: "923009999999", timestamp: "1700000000", type: "text", text: { body: "Old question" } },
      { id: "old-out", from: "923001111111", timestamp: "1700000100", type: "text", text: { body: "Old reply" } },
      { id: "bad-time", from: "923009999999", timestamp: "no", type: "text" },
      { id: "ambiguous", from: "923002222222", timestamp: "1700000100", type: "text" },
    ],
  }] }] });
  assert.equal((await webhook.POST(request("/api/whatsapp/webhook", payload, false))).status, 401);
  assert.equal(getMessages("7001").length, 0);
  for (let i = 0; i < 2; i++) assert.equal((await deliver(payload)).status, 200);
  const chats = getMessages("7001");
  assert.equal(chats.length, 2);
  assert.equal(chats[0].direction, "in");
  assert.equal(chats[0].timestamp, 1700000000000);
  assert.equal(chats[1].direction, "out");
  assert.equal(chats[1].to, "923009999999");
  assert.equal(getMessages("7002").length, 0);
  assert.equal(historyStatus("7001").count, 2);
  assert.equal(historyStatus("7001").progress, 60);
  assert.equal((await messages.GET(request("/api/whatsapp/messages?phoneNumberId=7001"))).status, 404);
  saveConnections([connection("7001", "8001")], "history-token");
  assert.equal((await (await messages.GET(request("/api/whatsapp/messages?phoneNumberId=7001"))).json()).messages.length, 2);
  // Out-of-order progress must not move backwards, and raw chunks remain available.
  payload.entry[0].changes[0].value.history[0].metadata.progress = 10;
  await deliver(payload);
  assert.equal(historyStatus("7001").progress, 60);
  assert.equal(db().prepare("SELECT COUNT(*) AS count FROM coexistence_events WHERE phone_number_id='7001'").get().count, 2);
});

test("app sent echoes deduplicate against API sends and contacts ignore out-of-order deletion reversals", async () => {
  const { getContacts } = require("../lib/coexistence-events.ts");
  addMessage({ id: "echo-api", phoneNumberId: "7001", from: "7001", to: "923009999999", text: "sent", direction: "out", timestamp: 1700000200000 });
  const payload = coexPayload("smb_message_echoes", { message_echoes: [
    { id: "echo-api", from: "923001111111", to: "923009999999", timestamp: "1700000200", type: "text", text: { body: "sent" } },
    { id: "echo-app", from: "923001111111", to: "923009999999", timestamp: "1700000201", type: "text", text: { body: "from phone" } },
  ] });
  await deliver(payload); await deliver(payload);
  assert.equal(getMessages("7001").filter(m => m.id.startsWith("echo-")).length, 2);
  assert.equal(getMessages("7001").find(m => m.id === "echo-app").direction, "out");
  const contact = (action, timestamp) => coexPayload("smb_app_state_sync", { state_sync: [{ type: "contact", action,
    contact: { phone_number: "923009999999", full_name: "Customer" }, metadata: { timestamp } }] });
  await deliver(contact("add", "1700000300"));
  assert.equal(getContacts("7001")["923009999999"], "Customer");
  await deliver(contact("remove", "1700000400"));
  await deliver(contact("add", "1700000350"));
  assert.equal(getContacts("7001")["923009999999"], undefined);
});

test("history denial and malformed signed payloads are handled without losing raw delivery", async () => {
  const { historyStatus } = require("../lib/coexistence-events.ts");
  await deliver(coexPayload("history", { history: [{ errors: [{ code: 2593109 }] }] }, "7003"));
  assert.match(historyStatus("7003").error, /disabled/);
  assert.equal(historyStatus("7003").count, 0);
  for (const payload of [coexPayload("history", { history: [null, { threads: [null, { messages: [null] }] }] }),
    { object: "whatsapp_business_account", entry: [null, { changes: null }] }]) {
    assert.equal((await deliver(payload)).status, 200);
  }
});

test("history request checks access, Coexistence and callback subscriptions before its one-time calls", async () => {
  const route = require("../app/api/whatsapp/history/route.ts");
  saveConnections([connection("7101")], "sync-token");
  let calls = mockSyncFetch({ fields: ["messages"] });
  assert.equal((await route.POST(request("/api/whatsapp/history", { phoneNumberId: "7101" }, false))).status, 401);
  assert.equal((await route.POST(request("/api/whatsapp/history", { phoneNumberId: "7101" }, true, { origin: "https://evil.example" }))).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await route.POST(request("/api/whatsapp/history", { phoneNumberId: "7101" }))).status, 502);
  assert.equal(calls.filter(call => call.url.includes("smb_app_data")).length, 0);
  calls = mockSyncFetch({ callbackUrl: "https://wrong.example/webhook" });
  assert.equal((await route.POST(request("/api/whatsapp/history", { phoneNumberId: "7101" }))).status, 502);
  assert.equal(calls.filter(call => call.url.includes("smb_app_data")).length, 0);
  calls = mockSyncFetch();
  for (let i = 0; i < 2; i++) {
    const response = await route.POST(request("/api/whatsapp/history", { phoneNumberId: "7101" }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "requested");
  }
  assert.equal(calls.filter(call => call.url.includes("smb_app_data")).length, 2);
  for (const call of calls.filter(call => call.url.includes("smb_app_data"))) assert.equal(call.options.headers.Authorization, "Bearer sync-token");
  assert.equal(JSON.stringify(await (await route.GET(request("/api/whatsapp/history?phoneNumberId=7101"))).json()).includes("sync-token"), false);
});

test("a contact failure does not block history and an uncertain history request is never automatically repeated", async () => {
  const { startCoexistenceSync } = require("../lib/coexistence-sync.ts");
  saveConnections([connection("7102")], "token");
  const calls = mockSyncFetch({ contacts: () => json({ error: { code: 190 } }, 400), history: () => { throw new Error("network timeout"); } });
  const result = await startCoexistenceSync("7102");
  assert.equal(result.status, "uncertain");
  assert.match(result.contactError, /190/);
  await startCoexistenceSync("7102", true);
  const historyCalls = calls.filter(call => call.url.includes("smb_app_data") && JSON.parse(call.options.body).sync_type === "history");
  assert.equal(historyCalls.length, 1);
});

test("concurrent history starts make at most one request per type and existing delivered history is not requested again", async () => {
  const { startCoexistenceSync } = require("../lib/coexistence-sync.ts");
  saveConnections([connection("7103")], "token");
  let calls = mockSyncFetch();
  await Promise.all([startCoexistenceSync("7103"), startCoexistenceSync("7103")]);
  assert.equal(calls.filter(call => call.url.includes("smb_app_data")).length, 2);
  calls = mockSyncFetch();
  await startCoexistenceSync("7001");
  // An ordinary contact update does not mean the initial contact import has run.
  assert.equal(calls.filter(call => call.url.includes("smb_app_data")).length, 1);
  assert.equal(calls.filter(call => call.url.includes("smb_app_data") && JSON.parse(call.options.body).sync_type === "history").length, 0);
});

test("hosted onboarding exchanges the system token against the customer portfolio and imports with the business token", async () => {
  const { reconcileHosted, hostedSettings } = require("../lib/hosted-onboarding.ts");
  db().prepare("DELETE FROM hosted_onboarding").run();
  db().prepare("DELETE FROM account_updates").run();
  const payload = { object: "whatsapp_business_account", entry: [{ id: "999999", changes: [{ field: "account_update",
    value: { event: "PARTNER_ADDED", waba_info: { waba_id: "8201", owner_business_id: "8301" } } }] }] };
  await deliver(payload); await deliver(payload);
  await reconcileHosted();
  assert.equal(hostedSettings().jobs.length, 1);
  assert.equal(hostedSettings().jobs[0].wabaId, "8201");
  assert.equal(hostedSettings().jobs[0].status, "pending");
  process.env.META_SYSTEM_USER_ACCESS_TOKEN = "hosted-secret";
  const calls = mockSyncFetch();
  const syncFetch = global.fetch;
  let exchanges = 0;
  global.fetch = async (url, options) => {
    if (url.includes("/system_user_access_tokens")) {
      exchanges++;
      assert.ok(url.includes("/8301/system_user_access_tokens"));
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer hosted-secret");
      assert.equal(options.headers["Content-Type"], "application/x-www-form-urlencoded");
      const body = new URLSearchParams(options.body);
      assert.equal(body.get("fetch_only"), "true");
      assert.equal(body.get("appsecret_proof"), createHmac("sha256", process.env.META_APP_SECRET).update("hosted-secret").digest("hex"));
      return json({ access_token: "customer-business-secret" });
    }
    if (url.includes("/phone_numbers")) {
      assert.ok(url.includes("8201/phone_numbers"));
      assert.equal(options.headers.Authorization, "Bearer customer-business-secret");
      return json({ data: [{ id: "7201", display_phone_number: "923001111111" }] });
    }
    return syncFetch(url, options);
  };
  try {
    await reconcileHosted(); await reconcileHosted();
    assert.equal(exchanges, 1);
    assert.equal(getCredentials("7201").accessToken, "customer-business-secret");
    assert.equal(hostedSettings().jobs[0].status, "complete");
    assert.equal(calls.filter(call => call.url.includes("smb_app_data")).length, 2);
    assert.equal(JSON.stringify(hostedSettings()).includes("hosted-secret"), false);
    assert.equal(JSON.stringify(hostedSettings()).includes("customer-business-secret"), false);
    for (const call of calls.filter(call => call.url.includes("smb_app_data"))) {
      assert.equal(call.options.headers.Authorization, "Bearer customer-business-secret");
    }
  } finally { delete process.env.META_SYSTEM_USER_ACCESS_TOKEN; }
});

test("hosted business token retrieval rejects missing customer portfolio and missing token responses", async () => {
  const { fetchHostedBusinessToken } = require("../lib/hosted-business-token.ts");
  let calls = 0;
  global.fetch = async () => { calls++; return json({}); };
  await assert.rejects(fetchHostedBusinessToken("999123", "system-secret"), /missing.*portfolio/);
  assert.equal(calls, 0);
  await assert.rejects(fetchHostedBusinessToken("8201", "system-secret"), /did not return/);
  assert.equal(calls, 1);
});

test("late media details replace placeholders without duplicating or reordering the message", () => {
  const message = { id: "media-late", phoneNumberId: "7001", from: "923009999999", to: "7001", direction: "in", timestamp: 1700000000000 };
  addMessage({ ...message, text: "[media_placeholder message]" });
  addMessage({ ...message, text: "Photo caption" });
  addMessage({ ...message, text: "[media_placeholder message]" });
  const rows = getMessages("7001").filter(m => m.id === "media-late");
  assert.equal(rows.length, 1); assert.equal(rows[0].text, "Photo caption");
});

test("database reset requires admin, same origin and confirmation, then clears local data atomically", async () => {
  const reset = require("../app/api/database/route.ts");
  const resetRequest = (auth = true, origin = "http://localhost:3000", confirmation = "CLEAR DATABASE") =>
    new NextRequest("http://localhost:3000/api/database", {
      method: "DELETE", headers: { origin, "content-type": "application/json", ...(auth ? { cookie: `crm_session=${createSession()}` } : {}) },
      body: JSON.stringify({ confirmation }),
    });
  global.fetch = async () => { throw new Error("Reset must not call Meta"); };
  saveConnections([connection("999001")], "reset-test-token");
  assert.equal((await reset.DELETE(resetRequest(false))).status, 401);
  assert.equal((await reset.DELETE(resetRequest(true, "https://foreign.example"))).status, 403);
  assert.equal((await reset.DELETE(resetRequest(true, undefined, ""))).status, 400);
  assert.ok(getCredentials("999001"));
  db().prepare("INSERT OR REPLACE INTO hosted_onboarding VALUES ('999001', 'processing', NULL, ?)").run(Date.now());
  assert.equal((await reset.DELETE(resetRequest())).status, 409);
  assert.ok(getCredentials("999001"));
  db().prepare("UPDATE hosted_onboarding SET status='complete'").run();
  db().prepare("UPDATE coexistence_requests SET status='requested' WHERE status='requesting'").run();
  // Older installations may still contain the removed signup flow's token tables.
  db().exec("CREATE TABLE IF NOT EXISTS signup_grants (encrypted_token TEXT); INSERT INTO signup_grants VALUES ('old-token')");
  assert.equal((await reset.DELETE(resetRequest())).status, 200);
  for (const table of ["connections", "messages", "contacts", "account_updates", "hosted_onboarding", "coexistence_events", "history_messages", "history_progress", "coexistence_requests", "signup_grants"]) {
    assert.equal(db().prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0, table);
  }
  assert.ok(db().prepare("SELECT 1 FROM migrations WHERE name='legacy_messages'").get());
  assert.equal((await reset.DELETE(resetRequest())).status, 200);
});
