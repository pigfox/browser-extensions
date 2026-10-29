import { parseTimestamp } from './time';

export interface TranscriptSegment {
  /** Seconds from the start of the video. */
  start: number;
  duration: number;
  text: string;
}

export interface Transcript {
  videoId: string;
  title: string;
  durationSeconds: number;
  segments: TranscriptSegment[];
}

export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  /** "asr" marks an auto-generated track. */
  kind?: string;
}

export interface PlayerResponse {
  videoDetails?: { videoId?: string; title?: string; lengthSeconds?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
}

interface Json3 {
  events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[];
}

export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const PLAYER_RESPONSE_MARKER = 'ytInitialPlayerResponse';

/** Returns the video ID of a youtube.com/watch URL, or null for any other URL. */
export function getVideoId(href: string): string | null {
  const url = new URL(href);
  if (!/(^|\.)youtube\.com$/.test(url.hostname) || url.pathname !== '/watch') return null;
  const id = url.searchParams.get('v');
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

function normalizeText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** Index of the brace that closes the JSON object opening at `start`, or -1. */
function findObjectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Pulls the `ytInitialPlayerResponse = {...}` object out of watch-page HTML or script text. */
export function extractPlayerResponse(html: string): PlayerResponse | null {
  let from = 0;
  for (;;) {
    const at = html.indexOf(PLAYER_RESPONSE_MARKER, from);
    if (at === -1) return null;
    from = at + PLAYER_RESPONSE_MARKER.length;
    const assignment = /^\s*=\s*\{/.exec(html.slice(from));
    if (!assignment) continue;
    const start = from + assignment[0].length - 1;
    const end = findObjectEnd(html, start);
    if (end === -1) return null;
    try {
      return JSON.parse(html.slice(start, end + 1)) as PlayerResponse;
    } catch {
      return null;
    }
  }
}

/** English captions first, then English auto-generated, then any auto-generated, then whatever exists. */
export function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  const isEnglish = (track: CaptionTrack) => track.languageCode === 'en' || track.languageCode.startsWith('en-');
  const isAuto = (track: CaptionTrack) => track.kind === 'asr';
  return (
    tracks.find((track) => isEnglish(track) && !isAuto(track)) ??
    tracks.find(isEnglish) ??
    tracks.find(isAuto) ??
    tracks[0] ??
    null
  );
}

/** Converts YouTube's json3 caption format into transcript segments. */
export function parseJson3(data: unknown): TranscriptSegment[] {
  const events = (data as Json3 | null)?.events ?? [];
  const segments: TranscriptSegment[] = [];
  for (const event of events) {
    if (!event.segs) continue;
    const text = normalizeText(event.segs.map((seg) => seg.utf8 ?? '').join(''));
    if (!text) continue;
    segments.push({ start: (event.tStartMs ?? 0) / 1000, duration: (event.dDurationMs ?? 0) / 1000, text });
  }
  return segments;
}

/** Reads the transcript panel ("Show transcript") when the viewer has opened it. */
export function readTranscriptPanel(doc: Document): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  for (const row of doc.querySelectorAll('ytd-transcript-segment-renderer')) {
    const start = parseTimestamp(row.querySelector('.segment-timestamp')?.textContent ?? '');
    const text = normalizeText(row.querySelector('.segment-text')?.textContent);
    if (start === null || !text) continue;
    segments.push({ start, duration: 0, text });
  }
  segments.forEach((segment, i) => {
    const next = segments[i + 1];
    if (next) segment.duration = Math.max(0, next.start - segment.start);
  });
  return segments;
}

function findPlayerResponseInPage(doc: Document, videoId: string): PlayerResponse | null {
  for (const script of doc.querySelectorAll('script')) {
    const text = script.textContent;
    if (!text.includes(PLAYER_RESPONSE_MARKER)) continue;
    const player = extractPlayerResponse(text);
    if (player?.videoDetails?.videoId === videoId) return player;
  }
  return null;
}

async function fetchPlayerResponse(videoId: string, fetchFn: FetchFn): Promise<PlayerResponse | null> {
  try {
    const response = await fetchFn(`https://www.youtube.com/watch?v=${videoId}`, { credentials: 'include' });
    if (!response.ok) return null;
    const player = extractPlayerResponse(await response.text());
    return player?.videoDetails?.videoId === videoId ? player : null;
  } catch {
    return null;
  }
}

async function fetchCaptionSegments(player: PlayerResponse | null, fetchFn: FetchFn): Promise<TranscriptSegment[]> {
  const track = pickCaptionTrack(player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []);
  if (!track) return [];
  try {
    const url = new URL(track.baseUrl, 'https://www.youtube.com');
    url.searchParams.set('fmt', 'json3');
    const response = await fetchFn(url.toString(), { credentials: 'include' });
    if (!response.ok) return [];
    return parseJson3(await response.json());
  } catch {
    return [];
  }
}

function videoElementDuration(doc: Document): number {
  const duration = doc.querySelector('video')?.duration ?? 0;
  return Number.isFinite(duration) ? duration : 0;
}

/** The page title without YouTube's " - YouTube" suffix. */
export function pageTitle(doc: Document): string {
  return doc.title.replace(/ - YouTube$/, '').trim();
}

/**
 * Loads the transcript of the video on a youtube.com/watch page: the caption
 * track from the player response first, the opened transcript panel second.
 * Returns null when there is no video or no transcript.
 */
export async function loadTranscript(doc: Document, fetchFn: FetchFn): Promise<Transcript | null> {
  const videoId = getVideoId(doc.location.href);
  if (!videoId) return null;

  const player = findPlayerResponseInPage(doc, videoId) ?? (await fetchPlayerResponse(videoId, fetchFn));
  let segments = await fetchCaptionSegments(player, fetchFn);
  if (segments.length === 0) segments = readTranscriptPanel(doc);
  const last = segments.at(-1);
  if (!last) return null;

  const durationSeconds =
    Number(player?.videoDetails?.lengthSeconds) || videoElementDuration(doc) || last.start + last.duration;
  return { videoId, title: player?.videoDetails?.title ?? pageTitle(doc), durationSeconds, segments };
}
