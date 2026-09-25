const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const HEADERS_TIMEOUT_MS = 30_000;
const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 8_000;

type ChatMessage = { role: "user" | "assistant"; content: string };

function isValidMessages(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_MESSAGES &&
    value.every(
      (m) =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length <= MAX_CONTENT_LENGTH,
    )
  );
}

function errorResponse(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model) {
    return errorResponse(500, "Сервер не настроен: проверьте .env.local");
  }

  const body = await req.json().catch(() => null);
  if (!isValidMessages(body?.messages)) {
    return errorResponse(400, "Некорректный формат сообщений");
  }
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), HEADERS_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        stream: true,
      }),
      signal: AbortSignal.any([req.signal, timeout.signal]),
    });
  } catch {
    if (timeout.signal.aborted) {
      return errorResponse(504, "Модель не ответила вовремя");
    }
    return errorResponse(502, "Не удалось связаться с OpenRouter");
  } finally {
    clearTimeout(timer);
  }

  if (!upstream.ok || !upstream.body) {
    const details = await upstream.json().catch(() => null);
    return errorResponse(
      upstream.ok ? 502 : upstream.status,
      details?.error?.message ?? `OpenRouter ответил ${upstream.status}`,
    );
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
