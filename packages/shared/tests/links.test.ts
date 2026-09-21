import { describe, expect, it } from 'vitest';
import { buildPigfoxLink } from '../src';

describe('buildPigfoxLink', () => {
  it('links to the home page with UTM parameters', () => {
    expect(buildPigfoxLink('/', 'ghost-job-detector')).toBe(
      'https://pigfox.com/?utm_source=ghost-job-detector&utm_medium=browser-extension',
    );
  });

  it('accepts paths with or without a leading slash', () => {
    expect(buildPigfoxLink('tools/json-ld', 'jsonld-schema-inspector')).toBe(
      'https://pigfox.com/tools/json-ld?utm_source=jsonld-schema-inspector&utm_medium=browser-extension',
    );
  });

  it('keeps existing query parameters and fragments', () => {
    expect(buildPigfoxLink('/blog?tag=web3#top', 'contract-safety-check')).toBe(
      'https://pigfox.com/blog?tag=web3&utm_source=contract-safety-check&utm_medium=browser-extension#top',
    );
  });

  it('overrides any UTM parameters already in the path', () => {
    const url = new URL(buildPigfoxLink('/?utm_source=other&utm_medium=email', 'dex-swap-cost-checker'));
    expect(url.searchParams.getAll('utm_source')).toEqual(['dex-swap-cost-checker']);
    expect(url.searchParams.getAll('utm_medium')).toEqual(['browser-extension']);
  });

  it('encodes the extension name', () => {
    expect(buildPigfoxLink('/', 'a b&c')).toBe(
      'https://pigfox.com/?utm_source=a+b%26c&utm_medium=browser-extension',
    );
  });

  it.each(['https://example.com/', '//example.com/path', 'http://pigfox.com/'])(
    'rejects paths that leave pigfox.com: %s',
    (path) => {
      expect(() => buildPigfoxLink(path, 'ghost-job-detector')).toThrow('Path must stay on https://pigfox.com');
    },
  );
});
