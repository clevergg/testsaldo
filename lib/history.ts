import type { Message } from "./chat";

const KEY = "chat-history";

function isMessage(value: unknown): value is Message {
  const m = value as Message;
  return (
    typeof m?.id === "string" &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string"
  );
}

export function loadHistory(): Message[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isMessage) : [];
  } catch {
    return [];
  }
}

export function saveHistory(messages: Message[]) {
  try {
    if (messages.length) {
      sessionStorage.setItem(KEY, JSON.stringify(messages));
    } else {
      sessionStorage.removeItem(KEY);
    }
  } catch {}
}
