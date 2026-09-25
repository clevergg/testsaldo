import { test } from "node:test";
import assert from "node:assert/strict";
import { readDeltas } from "./chat.ts";

function streamOf(...parts: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const out: string[] = [];
  for await (const delta of readDeltas(stream)) out.push(delta);
  return out;
}

const event = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

test("collects deltas split across chunk boundaries", async () => {
  const raw = ": OPENROUTER PROCESSING\n\n" + event("При") + event("вет") + "data: [DONE]\n\n";
  const cut = raw.indexOf("вет");
  assert.deepEqual(await collect(streamOf(raw.slice(0, cut), raw.slice(cut))), ["При", "вет"]);
});

test("keeps multibyte characters split between chunks", async () => {
  const bytes = new TextEncoder().encode(event("Привет"));
  const cut = bytes.indexOf(0xd0) + 1;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, cut));
      controller.enqueue(bytes.slice(cut));
      controller.close();
    },
  });
  assert.deepEqual(await collect(stream), ["Привет"]);
});

test("handles CRLF line endings", async () => {
  assert.deepEqual(await collect(streamOf(event("ok").replaceAll("\n", "\r\n"))), ["ok"]);
});

test("throws on a mid-stream error event", async () => {
  const raw = event("частично") + `data: {"error":{"message":"Rate limit"}}\n\n`;
  await assert.rejects(collect(streamOf(raw)), /Rate limit/);
});

test("maps a mid-stream 429 to a rate-limit error", async () => {
  const raw = `data: {"error":{"code":429,"message":"Provider returned error"}}\n\n`;
  await assert.rejects(collect(streamOf(raw)), { kind: "rate-limit" });
});
