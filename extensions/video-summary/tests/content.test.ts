import { describe, expect, it, vi } from 'vitest';
import { getVideoInfo, registerContentScript, seekVideo } from '../src/content';
import { fakeApi, flush, makeDocument, VIDEO_ID, WATCH_URL } from './fakes';

const PANEL =
  '<ytd-transcript-segment-renderer><div class="segment-timestamp">0:00</div><div class="segment-text">Hello</div></ytd-transcript-segment-renderer>';

describe('getVideoInfo', () => {
  it('returns the video ID and title on a watch page', () => {
    expect(getVideoInfo(makeDocument(WATCH_URL, '', 'A talk - YouTube'))).toEqual({ videoId: VIDEO_ID, title: 'A talk' });
  });

  it('returns null elsewhere', () => {
    expect(getVideoInfo(makeDocument('https://www.youtube.com/feed/subscriptions'))).toBeNull();
  });
});

describe('seekVideo', () => {
  it('moves the video', () => {
    const doc = makeDocument(WATCH_URL, '<video></video>');
    expect(seekVideo(doc, 42)).toBe(true);
    expect(doc.querySelector('video')?.currentTime).toBe(42);
  });

  it('reports a page without a video', () => {
    expect(seekVideo(makeDocument(WATCH_URL), 42)).toBe(false);
  });
});

describe('registerContentScript', () => {
  function setup(html = '') {
    const api = fakeApi();
    const doc = makeDocument(WATCH_URL, html, 'A talk - YouTube');
    const fetchFn = vi.fn(() => Promise.reject(new Error('offline')));
    registerContentScript(api, doc, fetchFn);
    const listener = api.listeners[0];
    if (!listener) throw new Error('no listener');
    return { doc, listener };
  }

  it('ignores messages it does not handle', () => {
    const { listener } = setup();
    const sendResponse = vi.fn();
    expect(listener({ type: 'summarize' }, {}, sendResponse)).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('answers video-info', () => {
    const { listener } = setup();
    const sendResponse = vi.fn();
    expect(listener({ type: 'video-info' }, {}, sendResponse)).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({ videoId: VIDEO_ID, title: 'A talk' });
  });

  it('seeks', () => {
    const { doc, listener } = setup('<video></video>');
    const sendResponse = vi.fn();
    listener({ type: 'seek', seconds: 12 }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith(true);
    expect(doc.querySelector('video')?.currentTime).toBe(12);
  });

  it('answers get-transcript asynchronously', async () => {
    const { listener } = setup(PANEL);
    const sendResponse = vi.fn();
    expect(listener({ type: 'get-transcript' }, {}, sendResponse)).toBe(true);
    await flush();
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      transcript: { videoId: VIDEO_ID, title: 'A talk', durationSeconds: 0, segments: [{ start: 0, duration: 0, text: 'Hello' }] },
    });
  });

  it('reports a missing transcript', async () => {
    const { listener } = setup();
    const sendResponse = vi.fn();
    listener({ type: 'get-transcript' }, {}, sendResponse);
    await flush();
    expect(sendResponse).toHaveBeenCalledWith({ ok: false });
  });
});
