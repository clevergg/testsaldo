import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Чат с ИИ",
  description: "Веб-чат с языковой моделью через OpenRouter",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
