import { BRAND_NAME, buildPigfoxLink } from '@pigfox/shared';
import { getCachedSummary } from './cache';
import type { CachedSummary } from './cache';
import { EXTENSION_NAME, STORE_NAME } from './extension';
import { isVideoInfo } from './messages';
import type { SummarizeRequest, SummarizeResponse } from './messages';
import type { ExtensionApi } from './platform';
import { loadSettings, modelLabel } from './settings';
import { formatDuration, formatTimestamp } from './time';

export const NOT_A_VIDEO = 'Open a YouTube video, then click this extension again.';
export const NO_TRANSCRIPT = 'No transcript available for this video';
export const NO_TRANSCRIPT_HINT =
  'If the video has captions, open its transcript (under the description, “Show transcript”) and try again.';
export const NO_KEY = 'Add your Anthropic API key in Options to summarize videos.';
export const WORKING =
  'Summarizing… Long videos can take a minute. You can close this popup; the summary will be here when you reopen it.';

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function button(doc: Document, text: string, onClick: () => void, className?: string): HTMLButtonElement {
  const element = el(doc, 'button', text, className);
  element.type = 'button';
  element.addEventListener('click', onClick);
  return element;
}

export async function renderPopup(root: HTMLElement, api: ExtensionApi): Promise<void> {
  const doc = root.ownerDocument;
  const storage = api.storage.local;
  const content = el(doc, 'main');

  const link = el(doc, 'a', `by ${BRAND_NAME}`);
  link.href = buildPigfoxLink('/', EXTENSION_NAME);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  const footer = el(doc, 'footer');
  footer.append(
    button(doc, 'Options', () => void api.runtime.openOptionsPage(), 'link-button'),
    link,
  );

  root.replaceChildren(el(doc, 'h1', STORE_NAME), content, footer);

  const show = (...nodes: Node[]) => content.replaceChildren(...nodes);
  const showMessage = (text: string, ...extra: Node[]) => show(el(doc, 'p', text, 'message'), ...extra);
  const showNoKey = () => showMessage(NO_KEY, button(doc, 'Open Options', () => void api.runtime.openOptionsPage()));

  const tabId = (await api.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  const info = tabId === undefined ? null : await api.tabs.sendMessage(tabId, { type: 'video-info' }).catch(() => null);
  if (tabId === undefined || !isVideoInfo(info)) {
    showMessage(NOT_A_VIDEO);
    return;
  }

  const seek = (seconds: number) => void api.tabs.sendMessage(tabId, { type: 'seek', seconds }).catch(() => undefined);

  const showSummary = (entry: CachedSummary, fromCache: boolean) => {
    const { summary } = entry;
    const tldr = el(doc, 'p', undefined, 'tldr');
    tldr.append(el(doc, 'strong', 'TL;DR '), summary.tldr);

    const saved = el(
      doc,
      'p',
      summary.timeSavedSeconds > 0
        ? `Time saved: about ${formatDuration(summary.timeSavedSeconds)} of ${formatDuration(entry.durationSeconds)}.`
        : `Time saved: none. Nothing to skip in this ${formatDuration(entry.durationSeconds)} video.`,
      'saved',
    );

    const points = el(doc, 'ul', undefined, 'points');
    for (const point of summary.keyPoints) {
      const item = el(doc, 'li');
      item.append(
        button(doc, formatTimestamp(point.seconds), () => seek(point.seconds), 'timestamp'),
        el(doc, 'span', point.point),
      );
      points.append(item);
    }

    const skips = el(doc, 'ul', undefined, 'skips');
    for (const range of summary.skip) {
      const item = el(doc, 'li');
      const jump = button(
        doc,
        `${formatTimestamp(range.start)}–${formatTimestamp(range.end)}`,
        () => seek(range.end),
        'timestamp',
      );
      jump.title = 'Jump past this part';
      item.append(jump, el(doc, 'span', range.reason));
      skips.append(item);
    }

    show(
      tldr,
      saved,
      el(doc, 'h2', 'Key points'),
      summary.keyPoints.length ? points : el(doc, 'p', 'No key points found.'),
      el(doc, 'h2', 'Skip'),
      summary.skip.length ? skips : el(doc, 'p', 'Nothing to skip.'),
      el(doc, 'p', `${modelLabel(entry.model)} · ${fromCache ? 'saved summary' : 'just now'}`, 'meta'),
      button(doc, 'Re-summarize', () => void run(true)),
    );
  };

  const run = async (force: boolean): Promise<void> => {
    showMessage(WORKING);
    const request: SummarizeRequest = { type: 'summarize', tabId, videoId: info.videoId, force };
    const response = (await api.runtime.sendMessage(request).catch(() => undefined)) as SummarizeResponse | undefined;
    switch (response?.status) {
      case 'ok':
        showSummary(response.entry, false);
        return;
      case 'no-key':
        showNoKey();
        return;
      case 'no-transcript':
        showMessage(NO_TRANSCRIPT, el(doc, 'p', NO_TRANSCRIPT_HINT, 'hint'));
        return;
      default:
        showMessage(
          response?.status === 'error' ? response.message : 'Something went wrong. Try again.',
          button(doc, 'Try again', () => void run(force)),
        );
    }
  };

  const cached = await getCachedSummary(storage, info.videoId);
  if (cached) {
    showSummary(cached, true);
    return;
  }
  if (!(await loadSettings(storage)).apiKey) {
    showNoKey();
    return;
  }
  show(el(doc, 'p', info.title, 'video-title'), button(doc, 'Summarize this video', () => void run(false)));
}
