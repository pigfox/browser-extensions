import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  CHUNK_CHARS,
  chunkLines,
  computeTimeSaved,
  describeError,
  formatTranscript,
  parseSummaryJson,
  SUMMARY_SCHEMA,
  summarizeTranscript,
  SYSTEM_PROMPT,
  toSummary,
} from '../src/summarize';
import type { FetchFn, Transcript } from '../src/youtube';
import { FAKE_KEY, jsonResponse, VIDEO_ID } from './fakes';

const RAW = {
  tldr: '  A song about commitment.  ',
  key_points: [
    { seconds: 43.6, point: ' Chorus begins ' },
    { seconds: 18, point: 'First verse' },
  ],
  skip: [
    { start_seconds: 200, end_seconds: 400, reason: 'Outro' },
    { start_seconds: 0, end_seconds: 18, reason: 'Intro' },
    { start_seconds: 50, end_seconds: 50, reason: 'Empty' },
  ],
};

const TRANSCRIPT: Transcript = {
  videoId: VIDEO_ID,
  title: 'Never Gonna Give You Up',
  durationSeconds: 213,
  segments: [
    { start: 0, duration: 18, text: 'music' },
    { start: 18, duration: 25, text: 'We are no strangers to love' },
  ],
};

function message(text: string, stopReason = 'end_turn') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text },
    ],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

function apiFetch(...bodies: unknown[]) {
  const queue = [...bodies];
  return vi.fn<FetchFn>(() => Promise.resolve(jsonResponse(queue.shift() ?? message(JSON.stringify(RAW)))));
}

function requestBody(fetchFn: ReturnType<typeof apiFetch>, call: number): Record<string, unknown> {
  return JSON.parse(String(fetchFn.mock.calls[call]?.[1]?.body)) as Record<string, unknown>;
}

describe('formatTranscript', () => {
  it('prefixes each line with its timestamp', () => {
    expect(formatTranscript(TRANSCRIPT.segments)).toEqual(['[0:00] music', '[0:18] We are no strangers to love']);
  });
});

describe('chunkLines', () => {
  it('keeps lines in order within the size limit', () => {
    expect(chunkLines(['aaaa', 'bbbb', 'cccc'], 10)).toEqual([['aaaa', 'bbbb'], ['cccc']]);
  });

  it('gives an oversized line a chunk of its own', () => {
    expect(chunkLines(['a', 'x'.repeat(20), 'b'], 10)).toEqual([['a'], ['x'.repeat(20)], ['b']]);
  });

  it('returns no chunks for no lines', () => {
    expect(chunkLines([], 10)).toEqual([]);
  });
});

describe('computeTimeSaved', () => {
  it('counts overlapping and nested ranges once', () => {
    expect(
      computeTimeSaved(
        [
          { start: 10, end: 20, reason: '' },
          { start: 15, end: 30, reason: '' },
          { start: 16, end: 18, reason: '' },
          { start: 40, end: 45, reason: '' },
        ],
        100,
      ),
    ).toBe(25);
  });

  it('clamps ranges to the video and drops empty ones', () => {
    expect(
      computeTimeSaved(
        [
          { start: -5, end: 5, reason: '' },
          { start: 90, end: 200, reason: '' },
          { start: 50, end: 40, reason: '' },
        ],
        100,
      ),
    ).toBe(15);
  });

  it('is zero with nothing to skip', () => {
    expect(computeTimeSaved([], 100)).toBe(0);
  });
});

describe('parseSummaryJson', () => {
  it('accepts the schema shape', () => {
    expect(parseSummaryJson(JSON.stringify(RAW))).toEqual(RAW);
  });

  it.each([
    ['not JSON', 'nope'],
    ['null', 'null'],
    ['a string', '"text"'],
    ['no tldr', JSON.stringify({ ...RAW, tldr: 1 })],
    ['key points not a list', JSON.stringify({ ...RAW, key_points: {} })],
    ['key point without seconds', JSON.stringify({ ...RAW, key_points: [{ point: 'x' }] })],
    ['key point without text', JSON.stringify({ ...RAW, key_points: [{ seconds: 1 }] })],
    ['skip not a list', JSON.stringify({ ...RAW, skip: null })],
    ['skip without start', JSON.stringify({ ...RAW, skip: [{ end_seconds: 1, reason: 'x' }] })],
    ['skip without end', JSON.stringify({ ...RAW, skip: [{ start_seconds: 1, reason: 'x' }] })],
    ['skip without reason', JSON.stringify({ ...RAW, skip: [{ start_seconds: 1, end_seconds: 2 }] })],
  ])('rejects %s', (_label, text) => {
    expect(() => parseSummaryJson(text)).toThrow('unexpected format');
  });
});

describe('toSummary', () => {
  it('trims, sorts, clamps and adds the time saved', () => {
    expect(toSummary(RAW, 213)).toEqual({
      tldr: 'A song about commitment.',
      keyPoints: [
        { seconds: 18, point: 'First verse' },
        { seconds: 44, point: 'Chorus begins' },
      ],
      skip: [
        { start: 0, end: 18, reason: 'Intro' },
        { start: 200, end: 213, reason: 'Outro' },
      ],
      timeSavedSeconds: 31,
    });
  });
});

describe('summarizeTranscript', () => {
  it('sends one structured-output request with the key and the browser-access header', async () => {
    const fetchFn = apiFetch();
    const summary = await summarizeTranscript(TRANSCRIPT, { apiKey: FAKE_KEY, model: 'claude-haiku-5-5', fetch: fetchFn });

    expect(summary).toEqual(toSummary(RAW, 213));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://api.anthropic.com/v1/messages');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${FAKE_KEY}`);
    expect(headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');

    const body = requestBody(fetchFn, 0);
    expect(body).toMatchObject({
      model: 'claude-haiku-5-5',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: SUMMARY_SCHEMA } },
    });
    const prompt = (body.messages as { content: string }[])[0]?.content;
    expect(prompt).toContain('Video title: Never Gonna Give You Up');
    expect(prompt).toContain('Video length: 4 min');
    expect(prompt).toContain('<transcript>\n[0:00] music\n[0:18] We are no strangers to love\n</transcript>');
  });

  it('uses the model chosen in options', async () => {
    const fetchFn = apiFetch();
    await summarizeTranscript(TRANSCRIPT, { apiKey: FAKE_KEY, model: 'claude-sonnet-5-5', fetch: fetchFn });
    expect(requestBody(fetchFn, 0).model).toBe('claude-sonnet-5-5');
  });

  it('summarizes a long transcript in parts, then merges them', async () => {
    const long: Transcript = {
      ...TRANSCRIPT,
      durationSeconds: 3000,
      segments: [0, 1000, 2000].map((start) => ({ start, duration: 1000, text: 'x'.repeat(CHUNK_CHARS * 0.6) })),
    };
    const part = (n: number) => message(JSON.stringify({ ...RAW, tldr: `part ${n}` }));
    const merged = { tldr: 'whole', key_points: [], skip: [{ start_seconds: 0, end_seconds: 60, reason: 'Intro' }] };
    const fetchFn = apiFetch(part(1), part(2), part(3), message(JSON.stringify(merged)));

    const summary = await summarizeTranscript(long, { apiKey: FAKE_KEY, model: 'claude-haiku-5-5', fetch: fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(4);
    const prompts = [0, 1, 2, 3].map((i) => (requestBody(fetchFn, i).messages as { content: string }[])[0]?.content);
    expect(prompts[0]).toContain('This is part 1 of 3');
    expect(prompts[2]).toContain('This is part 3 of 3');
    expect(prompts[3]).toContain('summaries of the 3 consecutive parts');
    expect(prompts[3]).toContain('"tldr":"part 2"');
    expect(summary).toEqual({ tldr: 'whole', keyPoints: [], skip: [{ start: 0, end: 60, reason: 'Intro' }], timeSavedSeconds: 60 });
  });

  it('reports a refusal', async () => {
    const fetchFn = apiFetch(message('', 'refusal'));
    await expect(
      summarizeTranscript(TRANSCRIPT, { apiKey: FAKE_KEY, model: 'claude-haiku-5-5', fetch: fetchFn }),
    ).rejects.toThrow('Claude declined to summarize this video.');
  });

  it('reports a cut-off answer', async () => {
    const fetchFn = apiFetch(message('{"tldr":', 'max_tokens'));
    await expect(
      summarizeTranscript(TRANSCRIPT, { apiKey: FAKE_KEY, model: 'claude-haiku-5-5', fetch: fetchFn }),
    ).rejects.toThrow('cut off');
  });

  it('turns an API error into a typed error', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        jsonResponse({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401),
      ),
    );
    const error: unknown = await summarizeTranscript(TRANSCRIPT, {
      apiKey: FAKE_KEY,
      model: 'claude-haiku-5-5',
      fetch: fetchFn,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Anthropic.AuthenticationError);
    expect(describeError(error)).toBe('Anthropic rejected the API key. Check it in Options.');
  });
});

describe('describeError', () => {
  const apiError = (status: number) => new Anthropic.APIError(status, undefined, 'x', new Headers());

  it.each([
    [403, 'not allowed to use the selected model'],
    [429, 'Rate limited'],
    [529, 'overloaded'],
    [500, 'Anthropic API error (500)'],
  ])('explains HTTP %s', (status, text) => {
    expect(describeError(apiError(status))).toContain(text);
  });

  it('explains a connection failure', () => {
    expect(describeError(new Anthropic.APIConnectionError({ message: 'down' }))).toContain('Could not reach Anthropic');
  });

  it('passes other errors through and never shows the key', () => {
    expect(describeError(new Error('Claude declined to summarize this video.'))).toBe(
      'Claude declined to summarize this video.',
    );
    expect(describeError('weird')).toBe('Something went wrong. Try again.');
  });
});
