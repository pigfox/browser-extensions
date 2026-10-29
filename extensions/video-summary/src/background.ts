import { getCachedSummary, setCachedSummary } from './cache';
import { isSummarizeRequest, isTranscriptResult } from './messages';
import type { SummarizeRequest, SummarizeResponse } from './messages';
import type { ExtensionApi, StorageArea } from './platform';
import { loadSettings } from './settings';
import { describeError, summarizeTranscript } from './summarize';
import type { FetchFn } from './youtube';

export interface BackgroundDeps {
  storage: StorageArea;
  sendToTab(tabId: number, message: unknown): Promise<unknown>;
  now(): number;
  /** Overrides the fetch used to reach the API (tests). */
  fetch?: FetchFn;
}

async function summarize(request: SummarizeRequest, deps: BackgroundDeps): Promise<SummarizeResponse> {
  if (!request.force) {
    const cached = await getCachedSummary(deps.storage, request.videoId);
    if (cached) return { status: 'ok', entry: cached };
  }

  const settings = await loadSettings(deps.storage);
  if (!settings.apiKey) return { status: 'no-key' };

  const result = await deps.sendToTab(request.tabId, { type: 'get-transcript' });
  if (!isTranscriptResult(result) || !result.ok) return { status: 'no-transcript' };
  const { transcript } = result;

  const summary = await summarizeTranscript(transcript, {
    apiKey: settings.apiKey,
    model: settings.model,
    ...(deps.fetch && { fetch: deps.fetch }),
  });
  const entry = {
    videoId: transcript.videoId,
    title: transcript.title,
    model: settings.model,
    durationSeconds: transcript.durationSeconds,
    createdAt: deps.now(),
    summary,
  };
  await setCachedSummary(deps.storage, entry);
  return { status: 'ok', entry };
}

/**
 * Returns the summarize handler. Runs in the background so a summary keeps
 * going (and lands in the cache) when the popup closes; a second request for a
 * video already being summarized waits for the first instead of paying twice.
 */
export function createSummarizer(deps: BackgroundDeps): (request: SummarizeRequest) => Promise<SummarizeResponse> {
  const inFlight = new Map<string, Promise<SummarizeResponse>>();
  return (request) => {
    const running = inFlight.get(request.videoId);
    if (running) return running;
    const task = summarize(request, deps)
      .catch((error: unknown): SummarizeResponse => ({ status: 'error', message: describeError(error) }))
      .finally(() => inFlight.delete(request.videoId));
    inFlight.set(request.videoId, task);
    return task;
  };
}

export function registerBackground(api: ExtensionApi, fetchFn?: FetchFn): void {
  const handle = createSummarizer({
    storage: api.storage.local,
    sendToTab: (tabId, message) => api.tabs.sendMessage(tabId, message),
    now: () => Date.now(),
    ...(fetchFn && { fetch: fetchFn }),
  });
  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isSummarizeRequest(message)) return false;
    void handle(message).then(sendResponse);
    return true;
  });
}
