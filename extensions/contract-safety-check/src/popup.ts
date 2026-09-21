import { BRAND_NAME, buildPigfoxLink } from '@pigfox/shared';
import { EXTENSION_NAME, STORE_NAME } from './extension';

export function renderPopup(root: HTMLElement): void {
  const doc = root.ownerDocument;

  const title = doc.createElement('h1');
  title.textContent = STORE_NAME;

  const status = doc.createElement('p');
  status.textContent = 'Coming soon';

  const link = doc.createElement('a');
  link.href = buildPigfoxLink('/', EXTENSION_NAME);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = `by ${BRAND_NAME}`;

  root.replaceChildren(title, status, link);
}
