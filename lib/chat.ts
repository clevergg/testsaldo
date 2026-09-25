export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
  stopped?: boolean;
};

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
          throw new Error(chunk.error.message ?? "Модель прервала ответ");
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
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    const details = await res.json().catch(() => null);
    throw new Error(details?.error ?? `Сервер ответил ${res.status}`);
  }
  yield* readDeltas(res.body);
}
