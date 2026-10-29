import { Window } from 'happy-dom';
import { vi } from 'vitest';
import type { ExtensionApi, MessageListener, StorageArea } from '../src/platform';

/** A fake API key for tests. Never a real key. */
export const FAKE_KEY = 'test-key-not-real';

export const VIDEO_ID = 'dQw4w9WgXcQ';
export const WATCH_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

export function fakeStorage(initial: Record<string, unknown> = {}): StorageArea & { data: Map<string, unknown> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: vi.fn((keys: string | string[]) => {
      const result: Record<string, unknown> = {};
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        if (data.has(key)) result[key] = data.get(key);
      }
      return Promise.resolve(result);
    }),
    set: vi.fn((items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) data.set(key, value);
      return Promise.resolve();
    }),
    remove: vi.fn((keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) data.delete(key);
      return Promise.resolve();
    }),
  };
}

export interface FakeApi extends ExtensionApi {
  listeners: MessageListener[];
  storage: { local: ReturnType<typeof fakeStorage> };
}

export function fakeApi(overrides: { storage?: ReturnType<typeof fakeStorage> } = {}): FakeApi {
  const listeners: MessageListener[] = [];
  return {
    listeners,
    runtime: {
      onMessage: { addListener: vi.fn((listener: MessageListener) => void listeners.push(listener)) },
      sendMessage: vi.fn(() => Promise.resolve(undefined)),
      openOptionsPage: vi.fn(() => Promise.resolve()),
    },
    tabs: {
      query: vi.fn(() => Promise.resolve([{ id: 7 }])),
      sendMessage: vi.fn(() => Promise.resolve(undefined)),
    },
    storage: { local: overrides.storage ?? fakeStorage() },
  };
}

/** A separate document at `url`, so tests can control location, title and markup. */
export function makeDocument(url: string, html = '', title = ''): Document {
  const window = new Window({ url });
  const doc = window.document as unknown as Document;
  doc.title = title;
  doc.body.innerHTML = html;
  return doc;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Waits for pending promise callbacks (and the timers they schedule) to run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
