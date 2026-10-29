import { beforeEach, describe, expect, it } from 'vitest';
import { renderOptions } from '../src/options';
import { FAKE_KEY, fakeStorage, flush } from './fakes';

let root: HTMLElement;

beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

function parts() {
  const buttons = [...root.querySelectorAll('button')];
  return {
    input: root.querySelector('#api-key') as HTMLInputElement,
    save: buttons.find((b) => b.textContent === 'Save key') as HTMLButtonElement,
    clear: buttons.find((b) => b.textContent === 'Remove key') as HTMLButtonElement,
    select: root.querySelector('#model') as HTMLSelectElement,
    keyStatus: root.querySelector('.key-status')?.textContent,
    status: root.querySelector('.status')?.textContent,
  };
}

describe('options page', () => {
  it('renders the form with branding and no saved key', async () => {
    await renderOptions(root, fakeStorage());
    const { input, clear, select, keyStatus } = parts();
    expect(root.querySelector('h1')?.textContent).toBe('Video Summary — by Pigfox: Options');
    expect(input.type).toBe('password');
    expect(input.value).toBe('');
    expect(keyStatus).toBe('No key saved yet.');
    expect(clear.hidden).toBe(true);
    expect([...select.options].map((o) => o.value)).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5']);
    expect(select.value).toBe('claude-haiku-5-5');
    const link = root.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toBe('https://pigfox.com/?utm_source=video-summary&utm_medium=browser-extension');
    expect(link.textContent).toBe('by Pigfox');
  });

  it('never puts a saved key back into the page', async () => {
    await renderOptions(root, fakeStorage({ anthropicApiKey: FAKE_KEY, model: 'claude-sonnet-5-5' }));
    const { input, clear, select, keyStatus } = parts();
    expect(input.value).toBe('');
    expect(root.innerHTML).not.toContain(FAKE_KEY);
    expect(keyStatus).toBe('A key is saved. Paste a new one to replace it.');
    expect(clear.hidden).toBe(false);
    expect(select.value).toBe('claude-sonnet-5-5');
  });

  it('saves a pasted key and clears the field', async () => {
    const storage = fakeStorage();
    await renderOptions(root, storage);
    const { input, save } = parts();
    input.value = `  ${FAKE_KEY}  `;
    save.click();
    await flush();
    expect(storage.data.get('anthropicApiKey')).toBe(FAKE_KEY);
    expect(parts().input.value).toBe('');
    expect(parts().status).toBe('Key saved.');
    expect(parts().keyStatus).toBe('A key is saved. Paste a new one to replace it.');
  });

  it('refuses an empty key', async () => {
    const storage = fakeStorage();
    await renderOptions(root, storage);
    parts().save.click();
    await flush();
    expect(storage.set).not.toHaveBeenCalled();
    expect(parts().status).toBe('Paste a key first.');
  });

  it('removes the key', async () => {
    const storage = fakeStorage({ anthropicApiKey: FAKE_KEY });
    await renderOptions(root, storage);
    parts().clear.click();
    await flush();
    expect(storage.data.has('anthropicApiKey')).toBe(false);
    expect(parts().status).toBe('Key removed.');
    expect(parts().clear.hidden).toBe(true);
  });

  it('saves the model choice', async () => {
    const storage = fakeStorage();
    await renderOptions(root, storage);
    const { select } = parts();
    select.value = 'claude-sonnet-5-5';
    select.dispatchEvent(new Event('change'));
    await flush();
    expect(storage.data.get('model')).toBe('claude-sonnet-5-5');
    expect(parts().status).toContain('Model saved.');
  });

  it('ignores a model value that is not offered', async () => {
    const storage = fakeStorage();
    await renderOptions(root, storage);
    const { select } = parts();
    select.value = 'nope';
    select.dispatchEvent(new Event('change'));
    await flush();
    expect(storage.set).not.toHaveBeenCalled();
  });
});
