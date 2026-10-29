import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheKey } from '../src/cache';
import type { CachedSummary } from '../src/cache';
import { NO_KEY, NO_TRANSCRIPT, NO_TRANSCRIPT_HINT, NOT_A_VIDEO, renderPopup, WORKING } from '../src/popup';
import { FAKE_KEY, fakeApi, fakeStorage, flush, VIDEO_ID } from './fakes';
import type { FakeApi } from './fakes';

const EXPECTED_LINK = 'https://pigfox.com/?utm_source=video-summary&utm_medium=browser-extension';

const ENTRY: CachedSummary = {
  videoId: VIDEO_ID,
  title: 'A talk',
  model: 'claude-haiku-5-5',
  durationSeconds: 1200,
  createdAt: 1,
  summary: {
    tldr: 'The talk explains caching.',
    keyPoints: [
      { seconds: 75, point: 'Caches trade memory for time.' },
      { seconds: 610, point: 'Invalidate on write.' },
    ],
    skip: [{ start: 0, end: 90, reason: 'Intro and sponsor' }],
    timeSavedSeconds: 90,
  },
};

function videoApi(storage = fakeStorage({ anthropicApiKey: FAKE_KEY })): FakeApi {
  const api = fakeApi({ storage });
  vi.mocked(api.tabs.sendMessage).mockImplementation((_tabId, message) =>
    Promise.resolve((message as { type: string }).type === 'video-info' ? { videoId: VIDEO_ID, title: 'A talk' } : true),
  );
  return api;
}

function text(root: HTMLElement): string {
  return root.textContent;
}

function clickButton(root: HTMLElement, label: string): void {
  const target = [...root.querySelectorAll('button')].find((b) => b.textContent === label);
  if (!target) throw new Error(`no button ${label}`);
  target.click();
}

let root: HTMLElement;

beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

describe('popup frame', () => {
  it('shows the store name, an Options button and the Pigfox link', async () => {
    const api = videoApi();
    await renderPopup(root, api);
    expect(root.querySelector('h1')?.textContent).toBe('Skip the Video — by Pigfox');
    const link = root.querySelector('footer a') as HTMLAnchorElement;
    expect(link.textContent).toBe('by Pigfox');
    expect(link.href).toBe(EXPECTED_LINK);
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    clickButton(root, 'Options');
    expect(api.runtime.openOptionsPage).toHaveBeenCalled();
  });
});

describe('popup states', () => {
  it('asks for a YouTube video when there is no active tab', async () => {
    const api = fakeApi();
    vi.mocked(api.tabs.query).mockResolvedValue([]);
    await renderPopup(root, api);
    expect(text(root)).toContain(NOT_A_VIDEO);
  });

  it('asks for a YouTube video when the tab has no content script', async () => {
    const api = fakeApi();
    vi.mocked(api.tabs.sendMessage).mockRejectedValue(new Error('no receiver'));
    await renderPopup(root, api);
    expect(text(root)).toContain(NOT_A_VIDEO);
  });

  it('asks for a YouTube video off a watch page', async () => {
    const api = fakeApi();
    vi.mocked(api.tabs.sendMessage).mockResolvedValue(null);
    await renderPopup(root, api);
    expect(text(root)).toContain(NOT_A_VIDEO);
  });

  it('asks for a key when none is saved', async () => {
    const api = videoApi(fakeStorage());
    await renderPopup(root, api);
    expect(text(root)).toContain(NO_KEY);
    clickButton(root, 'Open Options');
    expect(api.runtime.openOptionsPage).toHaveBeenCalled();
  });

  it('offers to summarize an uncached video', async () => {
    const api = videoApi();
    await renderPopup(root, api);
    expect(root.querySelector('.video-title')?.textContent).toBe('A talk');
    expect(api.runtime.sendMessage).not.toHaveBeenCalled();
  });
});

describe('summary view', () => {
  it('shows a cached summary straight away', async () => {
    const api = videoApi(fakeStorage({ anthropicApiKey: FAKE_KEY, [cacheKey(VIDEO_ID)]: ENTRY }));
    await renderPopup(root, api);
    expect(root.querySelector('.tldr')?.textContent).toBe('TL;DR The talk explains caching.');
    expect(root.querySelector('.saved')?.textContent).toBe('Time saved: about 2 min of 20 min.');
    expect([...root.querySelectorAll('.points li')].map((li) => li.textContent)).toEqual([
      '1:15Caches trade memory for time.',
      '10:10Invalidate on write.',
    ]);
    expect([...root.querySelectorAll('.skips li')].map((li) => li.textContent)).toEqual(['0:00–1:30Intro and sponsor']);
    expect(root.querySelector('.meta')?.textContent).toBe('Claude Haiku 5.5 (fast, lowest cost) · saved summary');
    expect(api.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('seeks the video from key points and skip ranges', async () => {
    const api = videoApi(fakeStorage({ [cacheKey(VIDEO_ID)]: ENTRY }));
    await renderPopup(root, api);
    clickButton(root, '10:10');
    const skip = root.querySelector('.skips button') as HTMLButtonElement;
    expect(skip.title).toBe('Jump past this part');
    skip.click();
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(7, { type: 'seek', seconds: 610 });
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(7, { type: 'seek', seconds: 90 });
  });

  it('ignores a seek the page cannot take', async () => {
    const api = videoApi(fakeStorage({ [cacheKey(VIDEO_ID)]: ENTRY }));
    await renderPopup(root, api);
    vi.mocked(api.tabs.sendMessage).mockRejectedValue(new Error('gone'));
    clickButton(root, '1:15');
    await flush();
    expect(root.querySelector('.tldr')).not.toBeNull();
  });

  it('says when there is nothing to skip or no key points', async () => {
    const empty = { ...ENTRY, summary: { ...ENTRY.summary, keyPoints: [], skip: [], timeSavedSeconds: 0 } };
    await renderPopup(root, videoApi(fakeStorage({ [cacheKey(VIDEO_ID)]: empty })));
    expect(root.querySelector('.saved')?.textContent).toBe('Time saved: none. Nothing to skip in this 20 min video.');
    expect(text(root)).toContain('No key points found.');
    expect(text(root)).toContain('Nothing to skip.');
  });
});

describe('summarizing', () => {
  it('summarizes on click and shows the result', async () => {
    const api = videoApi();
    let finish: (value: unknown) => void = () => undefined;
    vi.mocked(api.runtime.sendMessage).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await renderPopup(root, api);
    clickButton(root, 'Summarize this video');
    expect(text(root)).toContain(WORKING);
    expect(api.runtime.sendMessage).toHaveBeenCalledWith({ type: 'summarize', tabId: 7, videoId: VIDEO_ID, force: false });
    finish({ status: 'ok', entry: ENTRY });
    await flush();
    expect(root.querySelector('.meta')?.textContent).toBe('Claude Haiku 5.5 (fast, lowest cost) · just now');
  });

  it('re-summarizes past the cache', async () => {
    const api = videoApi(fakeStorage({ anthropicApiKey: FAKE_KEY, [cacheKey(VIDEO_ID)]: ENTRY }));
    vi.mocked(api.runtime.sendMessage).mockResolvedValue({ status: 'ok', entry: { ...ENTRY, model: 'claude-sonnet-5-5' } });
    await renderPopup(root, api);
    clickButton(root, 'Re-summarize');
    await flush();
    expect(api.runtime.sendMessage).toHaveBeenCalledWith({ type: 'summarize', tabId: 7, videoId: VIDEO_ID, force: true });
    expect(root.querySelector('.meta')?.textContent).toBe('Claude Sonnet 5.5 (more thorough) · just now');
  });

  it('shows the no-transcript message', async () => {
    const api = videoApi();
    vi.mocked(api.runtime.sendMessage).mockResolvedValue({ status: 'no-transcript' });
    await renderPopup(root, api);
    clickButton(root, 'Summarize this video');
    await flush();
    expect(root.querySelector('.message')?.textContent).toBe(NO_TRANSCRIPT);
    expect(root.querySelector('.hint')?.textContent).toBe(NO_TRANSCRIPT_HINT);
  });

  it('asks for a key if it was removed meanwhile', async () => {
    const api = videoApi();
    vi.mocked(api.runtime.sendMessage).mockResolvedValue({ status: 'no-key' });
    await renderPopup(root, api);
    clickButton(root, 'Summarize this video');
    await flush();
    expect(text(root)).toContain(NO_KEY);
  });

  it('shows an error and retries', async () => {
    const api = videoApi();
    vi.mocked(api.runtime.sendMessage)
      .mockResolvedValueOnce({ status: 'error', message: 'Rate limited by Anthropic.' })
      .mockRejectedValueOnce(new Error('background gone'))
      .mockResolvedValueOnce({ status: 'ok', entry: ENTRY });
    await renderPopup(root, api);
    clickButton(root, 'Summarize this video');
    await flush();
    expect(root.querySelector('.message')?.textContent).toBe('Rate limited by Anthropic.');
    clickButton(root, 'Try again');
    await flush();
    expect(root.querySelector('.message')?.textContent).toBe('Something went wrong. Try again.');
    clickButton(root, 'Try again');
    await flush();
    expect(root.querySelector('.tldr')).not.toBeNull();
    expect(api.runtime.sendMessage).toHaveBeenCalledTimes(3);
  });
});
