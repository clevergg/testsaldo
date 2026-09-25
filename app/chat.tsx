"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { streamReply, type Message } from "@/lib/chat";
import { loadHistory, saveHistory } from "@/lib/history";

const MAX_INPUT_LENGTH = 8_000;

const SUGGESTIONS = [
  "Объясни, что такое замыкание в JavaScript",
  "Придумай пять названий для кофейни у моря",
  "Составь план тренировок на неделю для новичка",
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const last = messages.length - 1;
    saveHistory(
      messages
        .map((m, i) => (isStreaming && i === last ? { ...m, stopped: true } : m))
        .filter((m) => m.content),
    );
  }, [messages, isStreaming]);

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

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  }

  function send(text = input) {
    const content = text.trim();
    if (!content || isStreaming) return;
    setInput("");
    inputRef.current?.focus();
    run([...messages, { id: crypto.randomUUID(), role: "user", content }]);
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
        <h1>Чат c ИИ</h1>
        {messages.length > 0 && (
          <button type="button" onClick={reset}>
            Новый диалог
          </button>
        )}
      </header>

      <section
        ref={logRef}
        className="chat-log"
        aria-label="Диалог"
        aria-live="polite"
        aria-busy={isStreaming}
      >
        {messages.length === 0 && (
          <div className="empty">
            <h2>С чего начнём?</h2>
            <p>
              Задайте вопрос или выберите пример. <kbd>Enter</kbd> отправляет,{" "}
              <kbd>Shift</kbd>+<kbd>Enter</kbd> переносит строку, <kbd>Esc</kbd>{" "}
              останавливает ответ.
            </p>
            <ul className="suggestions">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => send(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
          <span className="typing-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Модель печатает
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
          rows={1}
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
