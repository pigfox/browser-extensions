import { isContentRequest } from './messages';
import type { TranscriptResult, VideoInfo } from './messages';
import type { ExtensionApi } from './platform';
import { getVideoId, loadTranscript, pageTitle } from './youtube';
import type { FetchFn } from './youtube';

export function getVideoInfo(doc: Document): VideoInfo | null {
  const videoId = getVideoId(doc.location.href);
  return videoId ? { videoId, title: pageTitle(doc) } : null;
}

/** Moves the page's video to `seconds`; false when the page has no video. */
export function seekVideo(doc: Document, seconds: number): boolean {
  const video = doc.querySelector('video');
  if (!video) return false;
  video.currentTime = seconds;
  return true;
}

export function registerContentScript(api: Pick<ExtensionApi, 'runtime'>, doc: Document, fetchFn: FetchFn): void {
  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isContentRequest(message)) return false;
    switch (message.type) {
      case 'video-info':
        sendResponse(getVideoInfo(doc));
        return false;
      case 'seek':
        sendResponse(seekVideo(doc, message.seconds));
        return false;
      case 'get-transcript':
        void loadTranscript(doc, fetchFn).then((transcript) => {
          const result: TranscriptResult = transcript ? { ok: true, transcript } : { ok: false };
          sendResponse(result);
        });
        return true;
    }
  });
}
