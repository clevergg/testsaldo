# Чат с ИИ

Одностраничный веб-чат с языковой моделью через OpenRouter. Next.js (App Router) + TypeScript.

## Запуск

```bash
npm install
cp .env.example .env.local   # вписать OPENROUTER_API_KEY
npm run dev
```

Открыть http://localhost:3000.

## Ключевые решения

Будут дополняться по ходу работы.

- Next.js вместо отдельного бэкенда. Ключ OpenRouter нужен только на сервере, и Route Handler
  `app/api/chat` закрывает это без второго проекта. NestJS рассматривал, но для одного
  прокси-эндпоинта модули и DI ничего не дают.
