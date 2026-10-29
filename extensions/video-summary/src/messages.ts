import type { CachedSummary } from './cache';
import type { Transcript } from './youtube';

/** Popup or background → content script. */
export type ContentRequest = { type: 'video-info' } | { type: 'get-transcript' } | { type: 'seek'; seconds: number };

export interface VideoInfo {
  videoId: string;
  title: string;
}

export type TranscriptResult = { ok: true; transcript: Transcript } | { ok: false };

/** Popup → background. */
export interface SummarizeRequest {
  type: 'summarize';
  tabId: number;
  videoId: string;
  /** Skip the cache and ask Claude again. */
  force: boolean;
}

export type SummarizeResponse =
  | { status: 'ok'; entry: CachedSummary }
  | { status: 'no-key' }
  | { status: 'no-transcript' }
  | { status: 'error'; message: string };

function hasType(message: unknown): message is { type: unknown } {
  return typeof message === 'object' && message !== null && 'type' in message;
}

export function isContentRequest(message: unknown): message is ContentRequest {
  if (!hasType(message)) return false;
  if (message.type === 'seek') return typeof (message as { seconds?: unknown }).seconds === 'number';
  return message.type === 'video-info' || message.type === 'get-transcript';
}

export function isSummarizeRequest(message: unknown): message is SummarizeRequest {
  if (!hasType(message) || message.type !== 'summarize') return false;
  const request = message as Partial<SummarizeRequest>;
  return typeof request.tabId === 'number' && typeof request.videoId === 'string' && typeof request.force === 'boolean';
}

export function isVideoInfo(value: unknown): value is VideoInfo {
  const info = value as VideoInfo | null;
  return typeof info === 'object' && info !== null && typeof info.videoId === 'string' && typeof info.title === 'string';
}

export function isTranscriptResult(value: unknown): value is TranscriptResult {
  return typeof value === 'object' && value !== null && typeof (value as TranscriptResult).ok === 'boolean';
}
