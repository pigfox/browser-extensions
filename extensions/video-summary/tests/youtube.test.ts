import { describe, expect, it, vi } from 'vitest';
import {
  extractPlayerResponse,
  getVideoId,
  loadTranscript,
  pageTitle,
  parseJson3,
  pickCaptionTrack,
  readTranscriptPanel,
} from '../src/youtube';
import type { CaptionTrack, PlayerResponse } from '../src/youtube';
import { jsonResponse, makeDocument, VIDEO_ID, WATCH_URL } from './fakes';

const CAPTION_URL = 'https://www.youtube.com/api/timedtext?v=dQw4w9WgXcQ&lang=en';

function player(overrides: Partial<PlayerResponse> = {}, tracks: CaptionTrack[] = [{ baseUrl: CAPTION_URL, languageCode: 'en' }]): PlayerResponse {
  return {
    videoDetails: { videoId: VIDEO_ID, title: 'Never Gonna Give You Up', lengthSeconds: '213' },
    captions: { playerCaptionsTracklistRenderer: { captionTracks: tracks } },
    ...overrides,
  };
}

function playerScript(response: PlayerResponse): string {
  return `<script>var ytInitialPlayerResponse = ${JSON.stringify(response)};var meta = {};</script>`;
}

const JSON3 = {
  events: [
    { tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: 'We are ' }, { utf8: 'no strangers' }] },
    { tStartMs: 1500, dDurationMs: 2000, segs: [{ utf8: 'to love' }] },
  ],
};

const SEGMENTS = [
  { start: 0, duration: 1.5, text: 'We are no strangers' },
  { start: 1.5, duration: 2, text: 'to love' },
];

const PANEL = `
  <ytd-transcript-segment-renderer><div class="segment-timestamp">0:00</div><div class="segment-text">Intro music</div></ytd-transcript-segment-renderer>
  <ytd-transcript-segment-renderer><div class="segment-timestamp">0:10</div><div class="segment-text">  The   point </div></ytd-transcript-segment-renderer>`;

describe('getVideoId', () => {
  it.each([
    [WATCH_URL, VIDEO_ID],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42', VIDEO_ID],
    ['https://m.youtube.com/watch?list=x&v=dQw4w9WgXcQ', VIDEO_ID],
  ])('reads %s', (url, id) => {
    expect(getVideoId(url)).toBe(id);
  });

  it.each([
    'https://www.youtube.com/',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=short',
    'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
    'https://example.com/watch?v=dQw4w9WgXcQ',
  ])('returns null for %s', (url) => {
    expect(getVideoId(url)).toBeNull();
  });
});

describe('extractPlayerResponse', () => {
  it('finds the assignment after other mentions of the name', () => {
    const response = player();
    const html = `window["ytInitialPlayerResponse"] = null; var ytInitialPlayerResponse = ${JSON.stringify(response)};`;
    expect(extractPlayerResponse(html)).toEqual(response);
  });

  it('handles braces and escaped quotes inside strings', () => {
    const response = { videoDetails: { title: 'a {tricky} "title" \\ here }' } };
    expect(extractPlayerResponse(`ytInitialPlayerResponse={"videoDetails":${JSON.stringify(response.videoDetails)}};`)).toEqual(
      response,
    );
  });

  it('returns null when the name is missing', () => {
    expect(extractPlayerResponse('<html></html>')).toBeNull();
  });

  it('returns null when the object never closes', () => {
    expect(extractPlayerResponse('ytInitialPlayerResponse = {"a": {"b": 1}')).toBeNull();
  });

  it('returns null when the object is not JSON', () => {
    expect(extractPlayerResponse('ytInitialPlayerResponse = {a: 1};')).toBeNull();
  });
});

describe('pickCaptionTrack', () => {
  const manualEn = { baseUrl: 'manual-en', languageCode: 'en' };
  const autoEn = { baseUrl: 'auto-en', languageCode: 'en', kind: 'asr' };
  const manualEnGb = { baseUrl: 'manual-en-gb', languageCode: 'en-GB' };
  const manualDe = { baseUrl: 'manual-de', languageCode: 'de' };
  const autoDe = { baseUrl: 'auto-de', languageCode: 'de', kind: 'asr' };

  it('prefers English captions written by a person', () => {
    expect(pickCaptionTrack([manualDe, autoEn, manualEn])).toBe(manualEn);
    expect(pickCaptionTrack([manualDe, manualEnGb])).toBe(manualEnGb);
  });

  it('falls back to English auto-generated captions', () => {
    expect(pickCaptionTrack([manualDe, autoEn])).toBe(autoEn);
  });

  it('falls back to any auto-generated captions', () => {
    expect(pickCaptionTrack([manualDe, autoDe])).toBe(autoDe);
  });

  it('falls back to the first track', () => {
    expect(pickCaptionTrack([manualDe])).toBe(manualDe);
  });

  it('returns null without tracks', () => {
    expect(pickCaptionTrack([])).toBeNull();
  });
});

describe('parseJson3', () => {
  it('joins segment text and converts milliseconds', () => {
    expect(parseJson3(JSON3)).toEqual(SEGMENTS);
  });

  it('skips events without text and fills in missing numbers', () => {
    expect(
      parseJson3({
        events: [{ tStartMs: 0 }, { segs: [{ utf8: '\n' }] }, { segs: [{}, { utf8: 'hi\nthere' }] }],
      }),
    ).toEqual([{ start: 0, duration: 0, text: 'hi there' }]);
  });

  it('returns nothing for empty or unexpected data', () => {
    expect(parseJson3(null)).toEqual([]);
    expect(parseJson3({})).toEqual([]);
  });
});

describe('readTranscriptPanel', () => {
  it('reads timestamps and text, and works out durations', () => {
    const doc = makeDocument(WATCH_URL, PANEL);
    expect(readTranscriptPanel(doc)).toEqual([
      { start: 0, duration: 10, text: 'Intro music' },
      { start: 10, duration: 0, text: 'The point' },
    ]);
  });

  it('skips rows without a timestamp or text', () => {
    const doc = makeDocument(
      WATCH_URL,
      `<ytd-transcript-segment-renderer><div class="segment-text">no time</div></ytd-transcript-segment-renderer>
       <ytd-transcript-segment-renderer><div class="segment-timestamp">0:05</div></ytd-transcript-segment-renderer>`,
    );
    expect(readTranscriptPanel(doc)).toEqual([]);
  });
});

describe('pageTitle', () => {
  it('drops the YouTube suffix', () => {
    expect(pageTitle(makeDocument(WATCH_URL, '', 'A talk - YouTube'))).toBe('A talk');
  });
});

describe('loadTranscript', () => {
  it('returns null off a watch page without fetching', async () => {
    const fetchFn = vi.fn();
    expect(await loadTranscript(makeDocument('https://www.youtube.com/'), fetchFn)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('uses the player response in the page and fetches json3 captions', async () => {
    const doc = makeDocument(WATCH_URL, playerScript(player()));
    const fetchFn = vi.fn(() => Promise.resolve(jsonResponse(JSON3)));
    expect(await loadTranscript(doc, fetchFn)).toEqual({
      videoId: VIDEO_ID,
      title: 'Never Gonna Give You Up',
      durationSeconds: 213,
      segments: SEGMENTS,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(`${CAPTION_URL}&fmt=json3`, { credentials: 'include' });
  });

  it('fetches the watch page when the page holds another video (YouTube navigated in place)', async () => {
    const other = player({ videoDetails: { videoId: 'otherVideo1' } });
    const doc = makeDocument(WATCH_URL, `<script>var x = 1;</script>${playerScript(other)}`);
    const fetchFn = vi.fn((input: string | URL | Request) =>
      Promise.resolve(
        String(input).startsWith('https://www.youtube.com/watch')
          ? new Response(`<html>${playerScript(player())}</html>`)
          : jsonResponse(JSON3),
      ),
    );
    const transcript = await loadTranscript(doc, fetchFn);
    expect(fetchFn).toHaveBeenNthCalledWith(1, WATCH_URL, { credentials: 'include' });
    expect(transcript?.segments).toEqual(SEGMENTS);
  });

  it('reads the transcript panel when the caption fetch returns nothing usable', async () => {
    const doc = makeDocument(WATCH_URL, playerScript(player()) + PANEL);
    const fetchFn = vi.fn(() => Promise.resolve(new Response('', { status: 200 })));
    const transcript = await loadTranscript(doc, fetchFn);
    expect(transcript?.segments).toHaveLength(2);
  });

  it('reads the transcript panel when the caption fetch fails', async () => {
    const doc = makeDocument(WATCH_URL, playerScript(player()) + PANEL);
    const fetchFn = vi.fn(() => Promise.resolve(new Response('no', { status: 403 })));
    expect((await loadTranscript(doc, fetchFn))?.segments).toHaveLength(2);
  });

  it('falls back to the page title, the video element and the panel when the watch page cannot be read', async () => {
    const doc = makeDocument(WATCH_URL, `<video></video>${PANEL}`, 'Fallback title - YouTube');
    Object.defineProperty(doc.querySelector('video'), 'duration', { value: 95 });
    const fetchFn = vi.fn(() => Promise.reject(new Error('offline')));
    expect(await loadTranscript(doc, fetchFn)).toEqual({
      videoId: VIDEO_ID,
      title: 'Fallback title',
      durationSeconds: 95,
      segments: readTranscriptPanel(doc),
    });
  });

  it('ignores a watch page that fails or holds another video', async () => {
    const doc = makeDocument(WATCH_URL, PANEL);
    const failing = vi.fn(() => Promise.resolve(new Response('', { status: 500 })));
    expect((await loadTranscript(doc, failing))?.title).toBe('');
    const otherVideo = vi.fn(() => Promise.resolve(new Response(playerScript(player({ videoDetails: { videoId: 'otherVideo1' } })))));
    expect((await loadTranscript(doc, otherVideo))?.segments).toHaveLength(2);
    const noPlayer = vi.fn(() => Promise.resolve(new Response('<html></html>')));
    expect((await loadTranscript(doc, noPlayer))?.segments).toHaveLength(2);
  });

  it('estimates the length from the last segment when nothing else knows it', async () => {
    const doc = makeDocument(WATCH_URL, `<video></video>${PANEL}`);
    Object.defineProperty(doc.querySelector('video'), 'duration', { value: Number.NaN });
    const noLength = player({ videoDetails: { videoId: VIDEO_ID } }, []);
    const transcript = await loadTranscript(makeDocument(WATCH_URL, playerScript(noLength) + PANEL), vi.fn());
    expect(transcript?.durationSeconds).toBe(10);
    expect((await loadTranscript(doc, vi.fn(() => Promise.reject(new Error('x')))))?.durationSeconds).toBe(10);
  });

  it('returns null when there are no captions and no panel', async () => {
    const doc = makeDocument(WATCH_URL, playerScript(player({ captions: {} })));
    const fetchFn = vi.fn();
    expect(await loadTranscript(doc, fetchFn)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('survives a caption track with an unusable URL', async () => {
    const doc = makeDocument(WATCH_URL, playerScript(player({}, [{ baseUrl: 'http://[bad', languageCode: 'en' }])));
    expect(await loadTranscript(doc, vi.fn())).toBeNull();
  });
});
