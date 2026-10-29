import { BRAND_NAME, buildPigfoxLink } from '@pigfox/shared';
import { EXTENSION_NAME, STORE_NAME } from './extension';
import type { StorageArea } from './platform';
import { clearApiKey, isModelId, loadSettings, MODELS, saveApiKey, saveModel } from './settings';

/**
 * Renders the options page. The saved key is never put back into the page:
 * the field stays empty and only says whether a key is saved.
 */
export async function renderOptions(root: HTMLElement, storage: StorageArea): Promise<void> {
  const doc = root.ownerDocument;
  const settings = await loadSettings(storage);

  const title = doc.createElement('h1');
  title.textContent = `${STORE_NAME}: Options`;

  const intro = doc.createElement('p');
  intro.textContent =
    'Summaries are made by Claude with your own Anthropic API key. The key is stored only in this browser ' +
    '(extension local storage) and is sent only to api.anthropic.com. Create a key at console.anthropic.com.';

  const keyLabel = doc.createElement('label');
  keyLabel.htmlFor = 'api-key';
  keyLabel.textContent = 'Anthropic API key';
  const keyInput = doc.createElement('input');
  keyInput.id = 'api-key';
  keyInput.type = 'password';
  keyInput.autocomplete = 'off';
  keyInput.spellcheck = false;

  const keyStatus = doc.createElement('p');
  keyStatus.className = 'key-status';
  const status = doc.createElement('p');
  status.className = 'status';
  status.setAttribute('role', 'status');

  const saveButton = doc.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = 'Save key';
  const clearButton = doc.createElement('button');
  clearButton.type = 'button';
  clearButton.textContent = 'Remove key';

  const showKeyState = (saved: boolean) => {
    keyStatus.textContent = saved ? 'A key is saved. Paste a new one to replace it.' : 'No key saved yet.';
    keyInput.placeholder = saved ? '•••••••• (saved)' : 'sk-ant-…';
    clearButton.hidden = !saved;
  };
  showKeyState(settings.apiKey !== '');

  saveButton.addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (!key) {
      status.textContent = 'Paste a key first.';
      return;
    }
    void saveApiKey(storage, key).then(() => {
      keyInput.value = '';
      showKeyState(true);
      status.textContent = 'Key saved.';
    });
  });

  clearButton.addEventListener('click', () => {
    void clearApiKey(storage).then(() => {
      showKeyState(false);
      status.textContent = 'Key removed.';
    });
  });

  const modelLabel = doc.createElement('label');
  modelLabel.htmlFor = 'model';
  modelLabel.textContent = 'Model';
  const modelSelect = doc.createElement('select');
  modelSelect.id = 'model';
  for (const model of MODELS) {
    const option = doc.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    modelSelect.append(option);
  }
  modelSelect.value = settings.model;
  modelSelect.addEventListener('change', () => {
    const model = modelSelect.value;
    if (!isModelId(model)) return;
    void saveModel(storage, model).then(() => {
      status.textContent = 'Model saved. Summaries already made keep the model they were made with.';
    });
  });

  const link = doc.createElement('a');
  link.href = buildPigfoxLink('/', EXTENSION_NAME);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = `by ${BRAND_NAME}`;

  const keyRow = doc.createElement('div');
  keyRow.className = 'row';
  keyRow.append(keyInput, saveButton, clearButton);

  root.replaceChildren(title, intro, keyLabel, keyRow, keyStatus, modelLabel, modelSelect, status, link);
}
