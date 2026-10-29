import { describe, expect, it } from 'vitest';
import { isContentRequest, isSummarizeRequest, isTranscriptResult, isVideoInfo } from '../src/messages';

describe('message guards', () => {
  it.each([{ type: 'video-info' }, { type: 'get-transcript' }, { type: 'seek', seconds: 4 }])(
    'accepts content request %j',
    (message) => {
      expect(isContentRequest(message)).toBe(true);
    },
  );

  it.each([null, 'video-info', {}, { type: 'seek' }, { type: 'seek', seconds: '4' }, { type: 'other' }])(
    'rejects content request %j',
    (message) => {
      expect(isContentRequest(message)).toBe(false);
    },
  );

  it('checks summarize requests', () => {
    expect(isSummarizeRequest({ type: 'summarize', tabId: 1, videoId: 'v', force: false })).toBe(true);
    expect(isSummarizeRequest({ type: 'summarize', tabId: '1', videoId: 'v', force: false })).toBe(false);
    expect(isSummarizeRequest({ type: 'summarize', tabId: 1, videoId: 2, force: false })).toBe(false);
    expect(isSummarizeRequest({ type: 'summarize', tabId: 1, videoId: 'v' })).toBe(false);
    expect(isSummarizeRequest({ type: 'seek', seconds: 1 })).toBe(false);
    expect(isSummarizeRequest(undefined)).toBe(false);
  });

  it('checks video info', () => {
    expect(isVideoInfo({ videoId: 'v', title: 't' })).toBe(true);
    expect(isVideoInfo({ videoId: 'v' })).toBe(false);
    expect(isVideoInfo({ title: 't' })).toBe(false);
    expect(isVideoInfo(null)).toBe(false);
    expect(isVideoInfo('v')).toBe(false);
  });

  it('checks transcript results', () => {
    expect(isTranscriptResult({ ok: false })).toBe(true);
    expect(isTranscriptResult({ ok: 'yes' })).toBe(false);
    expect(isTranscriptResult(null)).toBe(false);
    expect(isTranscriptResult(3)).toBe(false);
  });
});
