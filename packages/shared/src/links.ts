import { SITE_URL } from './brand';

/**
 * Builds a pigfox.com link tagged with UTM parameters so analytics can
 * attribute the visit to the extension it came from.
 */
export function buildPigfoxLink(path: string, extensionName: string): string {
  const url = new URL(path, SITE_URL);
  if (url.origin !== new URL(SITE_URL).origin) {
    throw new Error(`Path must stay on ${SITE_URL}: ${path}`);
  }
  url.searchParams.set('utm_source', extensionName);
  url.searchParams.set('utm_medium', 'browser-extension');
  return url.toString();
}
