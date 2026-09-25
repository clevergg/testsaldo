"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { streamReply, type Message } from "@/lib/chat";

const MAX_INPUT_LENGTH = 8_000;

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      abortRef.current?.abort();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isStreaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function stop() {
    abortRef.current?.abort();
    inputRef.current?.focus();
  }

  function send() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    run([...messages, { id: crypto.randomUUID(), role: "user", content: text }]);
  }

  function retry() {
    inputRef.current?.focus();
    run(messages.at(-1)?.failed ? messages.slice(0, -1) : messages);
  }

  async function run(history: Message[]) {
    const replyId = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;
    setMessages([...history, { id: replyId, role: "assistant", content: "" }]);
    setError(null);
    setIsStreaming(true);

    try {
      for await (const delta of streamReply(history, controller.signal)) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === replyId ? { ...m, content: m.content + delta } : m,
          ),
        );
      }
    } catch (e) {
      const stopped = controller.signal.aborted;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === replyId ? { ...m, stopped, failed: !stopped } : m,
        ),
      );
      if (!stopped) {
        setError(e instanceof Error ? e.message : "Что-то пошло не так");
      }
    } finally {
      setMessages((prev) => prev.filter((m) => m.id !== replyId || m.content));
      abortRef.current = null;
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
                {m.stopped && (
                  <small className="message-note">Ответ остановлен</small>
                )}
                {m.failed && (
                  <small className="message-note">Ответ прервался из-за ошибки</small>
                )}
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
        <div role="alert" className="error">
          <p>{error}</p>
          <button type="button" onClick={retry}>
            Повторить
          </button>
        </div>
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
          ref={inputRef}
          id="prompt"
          rows={2}
          maxLength={MAX_INPUT_LENGTH}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Спросите что-нибудь"
        />
        <button
          type={isStreaming ? "button" : "submit"}
          onClick={isStreaming ? stop : undefined}
          aria-keyshortcuts={isStreaming ? "Escape" : undefined}
        >
          {isStreaming ? "Стоп" : "Отправить"}
        </button>
      </form>
    </main>
  );
}
