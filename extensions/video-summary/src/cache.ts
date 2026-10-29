import type { StorageArea } from './platform';
import type { Summary } from './summarize';

export interface CachedSummary {
  videoId: string;
  title: string;
  model: string;
  durationSeconds: number;
  /** Milliseconds since the epoch. */
  createdAt: number;
  summary: Summary;
}

export function cacheKey(videoId: string): string {
  return `summary:${videoId}`;
}

export async function getCachedSummary(storage: StorageArea, videoId: string): Promise<CachedSummary | null> {
  const key = cacheKey(videoId);
  const entry = (await storage.get(key))[key] as CachedSummary | undefined;
  return entry?.videoId === videoId ? entry : null;
}

export async function setCachedSummary(storage: StorageArea, entry: CachedSummary): Promise<void> {
  await storage.set({ [cacheKey(entry.videoId)]: entry });
}
