import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, flush, jsonResponse, makeDocument, VIDEO_ID, WATCH_URL } from './fakes';
import type { FakeApi } from './fakes';

const api: { current: FakeApi } = { current: fakeApi() };

vi.mock('wxt/browser', () => ({
  get browser() {
    return api.current;
  },
}));

beforeEach(() => {
  api.current = fakeApi();
  document.body.replaceChildren();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('entrypoints', () => {
  it('background registers the message handler', async () => {
    const { default: background } = await import('../entrypoints/background');
    background.main?.();
    expect(api.current.listeners).toHaveLength(1);
  });

  it('content script runs on all of youtube.com and fetches through the page', async () => {
    const { default: content } = await import('../entrypoints/youtube.content');
    expect(content.matches).toEqual(['https://www.youtube.com/*']);

    vi.stubGlobal('document', makeDocument(WATCH_URL));
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({}, 404)));
    vi.stubGlobal('fetch', fetchMock);
    void content.main({} as never);

    const sendResponse = vi.fn();
    api.current.listeners[0]?.({ type: 'get-transcript' }, {}, sendResponse);
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(`https://www.youtube.com/watch?v=${VIDEO_ID}`, { credentials: 'include' });
    expect(sendResponse).toHaveBeenCalledWith({ ok: false });
  });

  it('popup renders into the document body', async () => {
    vi.mocked(api.current.tabs.query).mockResolvedValue([]);
    await import('../entrypoints/popup/main');
    await flush();
    expect(document.body.querySelector('h1')?.textContent).toBe('Video Summary — by Pigfox');
  });

  it('options page renders into the document body', async () => {
    await import('../entrypoints/options/main');
    await flush();
    expect(document.body.querySelector('#api-key')).not.toBeNull();
  });
});
