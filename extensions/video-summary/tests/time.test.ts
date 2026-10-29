import { describe, expect, it } from 'vitest';
import { formatDuration, formatTimestamp, parseTimestamp } from '../src/time';

describe('formatTimestamp', () => {
  it.each([
    [0, '0:00'],
    [5.9, '0:05'],
    [65, '1:05'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
    [-4, '0:00'],
  ])('%s → %s', (seconds, expected) => {
    expect(formatTimestamp(seconds)).toBe(expected);
  });
});

describe('parseTimestamp', () => {
  it.each([
    ['0:05', 5],
    ['1:05', 65],
    [' 12:30 ', 750],
    ['1:02:05', 3725],
  ])('%s → %s', (text, expected) => {
    expect(parseTimestamp(text)).toBe(expected);
  });

  it.each(['', 'soon', '1:5', '1:2:3:4', '1:05 pm'])('rejects %j', (text) => {
    expect(parseTimestamp(text)).toBeNull();
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0 s'],
    [45, '45 s'],
    [59.4, '59 s'],
    [60, '1 min'],
    [754, '13 min'],
    [3600, '1 h'],
    [3900, '1 h 5 min'],
    [-10, '0 s'],
  ])('%s → %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});
