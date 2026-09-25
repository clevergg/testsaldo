export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
  stopped?: boolean;
  failed?: boolean;
};

export type ErrorKind = "rate-limit" | "timeout" | "network" | "server";

const IDLE_TIMEOUT_MS = 45_000;
const MAX_HISTORY = 20;

const ERROR_TEXT: Record<Exclude<ErrorKind, "server">, string> = {
  "rate-limit":
    "Бесплатная модель сейчас перегружена. Подождите минуту и попробуйте ещё раз.",
  timeout: "Модель слишком долго не отвечает. Попробуйте ещё раз.",
  network: "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.",
};

export class ChatError extends Error {
  kind: ErrorKind;

  constructor(kind: ErrorKind, message?: string) {
    super(kind === "server" ? message : ERROR_TEXT[kind]);
    this.kind = kind;
  }
}

function errorFromStatus(status: number, message: string) {
  if (status === 429) return new ChatError("rate-limit");
  if (status === 504 || status === 408) return new ChatError("timeout");
  return new ChatError("server", message);
}

export async function* readDeltas(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        const chunk = JSON.parse(data);
        if (chunk.error) {
          throw errorFromStatus(
            Number(chunk.error.code),
            chunk.error.message ?? "Модель прервала ответ",
          );
        }
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

export async function* streamReply(
  messages: Message[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  const idle = new AbortController();
  let timer = setTimeout(() => idle.abort(), IDLE_TIMEOUT_MS);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages
          .slice(-MAX_HISTORY)
          .map(({ role, content }) => ({ role, content })),
      }),
      signal: AbortSignal.any([signal, idle.signal]),
    });
    if (!res.ok || !res.body) {
      const details = await res.json().catch(() => null);
      throw errorFromStatus(
        res.status,
        details?.error ?? `Сервер ответил ${res.status}`,
      );
    }
    for await (const delta of readDeltas(res.body)) {
      clearTimeout(timer);
      timer = setTimeout(() => idle.abort(), IDLE_TIMEOUT_MS);
      yield delta;
    }
  } catch (e) {
    if (signal.aborted || e instanceof ChatError) throw e;
    throw new ChatError(idle.signal.aborted ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
}
