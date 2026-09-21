import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPopup } from '../src/popup';

const EXPECTED_LINK = 'https://pigfox.com/?utm_source=jsonld-schema-inspector&utm_medium=browser-extension';

function expectPopup(root: HTMLElement): void {
  expect(root.querySelector('h1')?.textContent).toBe('JSON-LD Schema Inspector — by Pigfox');
  expect(root.querySelector('p')?.textContent).toBe('Coming soon');
  const link = root.querySelector('a');
  expect(link?.textContent).toBe('by Pigfox');
  expect(link?.href).toBe(EXPECTED_LINK);
  expect(link?.target).toBe('_blank');
  expect(link?.rel).toBe('noopener noreferrer');
}

describe('popup', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.resetModules();
  });

  it('renders the store name, status and Pigfox link', () => {
    const root = document.createElement('div');
    root.append(document.createElement('span'));
    renderPopup(root);
    expect(root.children).toHaveLength(3);
    expectPopup(root);
  });

  it('renders into the document body when the entrypoint loads', async () => {
    await import('../entrypoints/popup/main');
    expectPopup(document.body);
  });
});
