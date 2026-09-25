import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function encryptionKey() {
  const value = process.env.CRM_ENCRYPTION_KEY || "";
  if (!/^[a-f\d]{64}$/i.test(value)) throw new Error("Set CRM_ENCRYPTION_KEY to a 64-character hex key in .env.local.");
  return Buffer.from(value, "hex");
}
export function encryptToken(token: string, phoneNumberId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(phoneNumberId));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64")).join(".");
}
export function decryptToken(value: string, phoneNumberId: string) {
  const [iv, tag, ciphertext] = value.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAAD(Buffer.from(phoneNumberId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
