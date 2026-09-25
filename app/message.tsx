import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/lib/chat";

const components: Components = {
  a: ({ href, children }) =>
    href ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      children
    ),
  pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
};

export const MessageItem = memo(function MessageItem({
  message,
}: {
  message: Message;
}) {
  const isUser = message.role === "user";
  return (
    <li className={`message message-${message.role}`}>
      <span className="visually-hidden">{isUser ? "Вы: " : "Модель: "}</span>
      {isUser ? (
        message.content
      ) : (
        <div className="markdown">
          <Markdown remarkPlugins={[remarkGfm]} components={components}>
            {message.content}
          </Markdown>
        </div>
      )}
      {message.stopped && (
        <small className="message-note">Ответ остановлен</small>
      )}
      {message.failed && (
        <small className="message-note">Ответ прервался из-за ошибки</small>
      )}
    </li>
  );
});
