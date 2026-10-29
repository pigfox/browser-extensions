import { describe, expect, it, vi } from 'vitest';
import { createSummarizer, registerBackground } from '../src/background';
import type { BackgroundDeps } from '../src/background';
import { cacheKey } from '../src/cache';
import type { CachedSummary } from '../src/cache';
import type { SummarizeRequest } from '../src/messages';
import type { Transcript } from '../src/youtube';
import { FAKE_KEY, fakeApi, fakeStorage, flush, jsonResponse, VIDEO_ID } from './fakes';

const TRANSCRIPT: Transcript = {
  videoId: VIDEO_ID,
  title: 'Title',
  durationSeconds: 120,
  segments: [{ start: 0, duration: 120, text: 'hello' }],
};

const RAW = { tldr: 'Short.', key_points: [{ seconds: 5, point: 'Point' }], skip: [{ start_seconds: 0, end_seconds: 5, reason: 'Intro' }] };

const CACHED: CachedSummary = {
  videoId: VIDEO_ID,
  title: 'Title',
  model: 'claude-haiku-5-5',
  durationSeconds: 120,
  createdAt: 1,
  summary: { tldr: 'cached', keyPoints: [], skip: [], timeSavedSeconds: 0 },
};

const REQUEST: SummarizeRequest = { type: 'summarize', tabId: 3, videoId: VIDEO_ID, force: false };

function apiFetch(status = 200) {
  return vi.fn(() =>
    Promise.resolve(
      status === 200
        ? jsonResponse({
            id: 'msg',
            type: 'message',
            role: 'assistant',
            model: 'claude-haiku-5-5',
            content: [{ type: 'text', text: JSON.stringify(RAW) }],
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 1 },
          })
        : jsonResponse({ type: 'error', error: { type: 'invalid_request_error', message: 'bad' } }, status),
    ),
  );
}

function deps(overrides: Partial<BackgroundDeps> = {}): BackgroundDeps & { storage: ReturnType<typeof fakeStorage> } {
  return {
    storage: fakeStorage({ anthropicApiKey: FAKE_KEY }),
    sendToTab: vi.fn(() => Promise.resolve({ ok: true, transcript: TRANSCRIPT })),
    now: () => 1000,
    fetch: apiFetch(),
    ...overrides,
  } as BackgroundDeps & { storage: ReturnType<typeof fakeStorage> };
}

describe('createSummarizer', () => {
  it('summarizes, caches and returns the entry', async () => {
    const d = deps();
    const response = await createSummarizer(d)(REQUEST);
    const entry = {
      videoId: VIDEO_ID,
      title: 'Title',
      model: 'claude-haiku-5-5',
      durationSeconds: 120,
      createdAt: 1000,
      summary: {
        tldr: 'Short.',
        keyPoints: [{ seconds: 5, point: 'Point' }],
        skip: [{ start: 0, end: 5, reason: 'Intro' }],
        timeSavedSeconds: 5,
      },
    };
    expect(response).toEqual({ status: 'ok', entry });
    expect(d.sendToTab).toHaveBeenCalledWith(3, { type: 'get-transcript' });
    expect(d.storage.data.get(cacheKey(VIDEO_ID))).toEqual(entry);
  });

  it('answers from the cache without asking the page or the API', async () => {
    const d = deps({ storage: fakeStorage({ anthropicApiKey: FAKE_KEY, [cacheKey(VIDEO_ID)]: CACHED }) });
    expect(await createSummarizer(d)(REQUEST)).toEqual({ status: 'ok', entry: CACHED });
    expect(d.sendToTab).not.toHaveBeenCalled();
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('bypasses the cache when forced', async () => {
    const d = deps({ storage: fakeStorage({ anthropicApiKey: FAKE_KEY, [cacheKey(VIDEO_ID)]: CACHED }) });
    const response = await createSummarizer(d)({ ...REQUEST, force: true });
    expect(response.status === 'ok' && response.entry.summary.tldr).toBe('Short.');
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it('asks for a key before doing anything else', async () => {
    const d = deps({ storage: fakeStorage() });
    expect(await createSummarizer(d)(REQUEST)).toEqual({ status: 'no-key' });
    expect(d.sendToTab).not.toHaveBeenCalled();
  });

  it.each([{ ok: false }, undefined])('makes no API call without a transcript (%j)', async (result) => {
    const d = deps({ sendToTab: vi.fn(() => Promise.resolve(result)) });
    expect(await createSummarizer(d)(REQUEST)).toEqual({ status: 'no-transcript' });
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('reports API errors in words', async () => {
    const d = deps({ fetch: apiFetch(400) });
    expect(await createSummarizer(d)(REQUEST)).toEqual({ status: 'error', message: 'Anthropic API error (400). Try again.' });
  });

  it('reports a page that stopped answering', async () => {
    const d = deps({ sendToTab: vi.fn(() => Promise.reject(new Error('Receiving end does not exist.'))) });
    expect(await createSummarizer(d)(REQUEST)).toEqual({ status: 'error', message: 'Receiving end does not exist.' });
  });

  it('runs one summary per video at a time', async () => {
    const d = deps();
    const summarize = createSummarizer(d);
    const first = summarize(REQUEST);
    const second = summarize({ ...REQUEST, force: true });
    expect(second).toBe(first);
    await first;
    expect(d.fetch).toHaveBeenCalledTimes(1);
    await summarize({ ...REQUEST, force: true });
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('registerBackground', () => {
  it('answers summarize messages and ignores others', async () => {
    const api = fakeApi({ storage: fakeStorage({ anthropicApiKey: FAKE_KEY }) });
    vi.mocked(api.tabs.sendMessage).mockResolvedValue({ ok: true, transcript: TRANSCRIPT });
    const fetchFn = apiFetch();
    registerBackground(api, fetchFn);
    const listener = api.listeners[0];
    expect(listener).toBeDefined();

    const ignored = vi.fn();
    expect(listener?.({ type: 'seek', seconds: 1 }, {}, ignored)).toBe(false);

    const sendResponse = vi.fn();
    expect(listener?.(REQUEST, {}, sendResponse)).toBe(true);
    await flush();
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(3, { type: 'get-transcript' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }));
    expect(ignored).not.toHaveBeenCalled();
  });

  it('uses the real clock and fetch by default', async () => {
    const api = fakeApi({ storage: fakeStorage({ [cacheKey(VIDEO_ID)]: CACHED }) });
    registerBackground(api);
    const sendResponse = vi.fn();
    api.listeners[0]?.(REQUEST, {}, sendResponse);
    await flush();
    expect(sendResponse).toHaveBeenCalledWith({ status: 'ok', entry: CACHED });
  });

  it('stamps new summaries with the current time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    const api = fakeApi({ storage: fakeStorage({ anthropicApiKey: FAKE_KEY }) });
    vi.mocked(api.tabs.sendMessage).mockResolvedValue({ ok: true, transcript: TRANSCRIPT });
    registerBackground(api, apiFetch());
    const sendResponse = vi.fn();
    api.listeners[0]?.(REQUEST, {}, sendResponse);
    await flush();
    vi.useRealTimers();
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ entry: expect.objectContaining({ createdAt: Date.parse('2026-10-29T12:00:00Z') }) }),
    );
  });
});
