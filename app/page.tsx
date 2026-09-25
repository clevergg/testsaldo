"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { streamReply, type Message } from "@/lib/chat";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const history: Message[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: text },
    ];
    const replyId = crypto.randomUUID();
    setMessages([...history, { id: replyId, role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setIsStreaming(true);

    try {
      for await (const delta of streamReply(history)) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === replyId ? { ...m, content: m.content + delta } : m,
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Что-то пошло не так");
    } finally {
      setMessages((prev) => prev.filter((m) => m.id !== replyId || m.content));
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  return (
    <main className="chat">
      <header className="chat-header">
        <h1>Чат с ИИ</h1>
      </header>

      <section
        ref={logRef}
        className="chat-log"
        aria-label="Диалог"
        aria-live="polite"
        aria-busy={isStreaming}
      >
        <ol className="messages">
          {messages
            .filter((m) => m.content)
            .map((m) => (
              <li key={m.id} className={`message message-${m.role}`}>
                <span className="visually-hidden">
                  {m.role === "user" ? "Вы: " : "Модель: "}
                </span>
                {m.content}
              </li>
            ))}
        </ol>
      </section>

      {isStreaming && (
        <p role="status" className="typing">
          Модель печатает…
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor="prompt" className="visually-hidden">
          Сообщение
        </label>
        <textarea
          id="prompt"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Спросите что-нибудь"
        />
        <button type="submit" disabled={isStreaming || !input.trim()}>
          Отправить
        </button>
      </form>
    </main>
  );
}
