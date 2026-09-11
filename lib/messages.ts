import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type ChatMessage = {
  id: string;
  from: string;
  to: string;
  text: string;
  direction: "in" | "out";
  timestamp: number;
};

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "messages.json");

function readAll(): ChatMessage[] {
  if (!existsSync(filePath)) return [];
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as ChatMessage[];
  } catch {
    return [];
  }
}

function writeAll(messages: ChatMessage[]) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(messages, null, 2));
}

export function getMessages(): ChatMessage[] {
  return readAll().sort((a, b) => a.timestamp - b.timestamp);
}

export function addMessage(message: ChatMessage) {
  const messages = readAll();
  if (messages.some((m) => m.id === message.id)) return;
  messages.push(message);
  writeAll(messages);
}
