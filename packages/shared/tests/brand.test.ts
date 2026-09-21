import { describe, expect, it } from 'vitest';
import { BRAND_NAME, SITE_URL } from '../src';

describe('brand constants', () => {
  it('exposes the brand name', () => {
    expect(BRAND_NAME).toBe('Pigfox');
  });

  it('exposes the site URL', () => {
    expect(SITE_URL).toBe('https://pigfox.com');
  });
});
