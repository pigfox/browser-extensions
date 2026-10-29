import { describe, expect, it } from 'vitest';
import { cacheKey, getCachedSummary, setCachedSummary } from '../src/cache';
import type { CachedSummary } from '../src/cache';
import {
  clearApiKey,
  DEFAULT_MODEL,
  isModelId,
  loadSettings,
  modelLabel,
  MODELS,
  saveApiKey,
  saveModel,
} from '../src/settings';
import { FAKE_KEY, fakeStorage, VIDEO_ID } from './fakes';

describe('settings', () => {
  it('defaults to no key and Claude Haiku 5.5', async () => {
    expect(DEFAULT_MODEL).toBe('claude-haiku-5-5');
    expect(await loadSettings(fakeStorage())).toEqual({ apiKey: '', model: 'claude-haiku-5-5' });
  });

  it('offers Haiku 5.5 and Sonnet 5.5', () => {
    expect(MODELS.map((model) => model.id)).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5']);
  });

  it('saves, loads and removes the key in local storage', async () => {
    const storage = fakeStorage();
    await saveApiKey(storage, FAKE_KEY);
    await saveModel(storage, 'claude-sonnet-5-5');
    expect(await loadSettings(storage)).toEqual({ apiKey: FAKE_KEY, model: 'claude-sonnet-5-5' });
    await clearApiKey(storage);
    expect(await loadSettings(storage)).toEqual({ apiKey: '', model: 'claude-sonnet-5-5' });
  });

  it('ignores stored values of the wrong type', async () => {
    const storage = fakeStorage({ anthropicApiKey: 42, model: 'gpt-x' });
    expect(await loadSettings(storage)).toEqual({ apiKey: '', model: DEFAULT_MODEL });
  });

  it('recognizes model IDs and labels them', () => {
    expect(isModelId('claude-sonnet-5-5')).toBe(true);
    expect(isModelId('claude-opus-5-5')).toBe(false);
    expect(modelLabel('claude-haiku-5-5')).toBe('Claude Haiku 5.5 (fast, lowest cost)');
    expect(modelLabel('claude-old')).toBe('claude-old');
  });
});

describe('summary cache', () => {
  const entry: CachedSummary = {
    videoId: VIDEO_ID,
    title: 'Title',
    model: 'claude-haiku-5-5',
    durationSeconds: 100,
    createdAt: 1,
    summary: { tldr: 't', keyPoints: [], skip: [], timeSavedSeconds: 0 },
  };

  it('stores one entry per video ID', async () => {
    const storage = fakeStorage();
    expect(await getCachedSummary(storage, VIDEO_ID)).toBeNull();
    await setCachedSummary(storage, entry);
    expect(storage.data.get(cacheKey(VIDEO_ID))).toEqual(entry);
    expect(await getCachedSummary(storage, VIDEO_ID)).toEqual(entry);
    expect(await getCachedSummary(storage, 'otherVideo1')).toBeNull();
  });

  it('ignores an entry stored under the wrong key', async () => {
    const storage = fakeStorage({ [cacheKey('otherVideo1')]: entry });
    expect(await getCachedSummary(storage, 'otherVideo1')).toBeNull();
  });
});
