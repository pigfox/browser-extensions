import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { registerContentScript } from '../src/content';

export default defineContentScript({
  // All of youtube.com, not only /watch: YouTube navigates between pages without reloading.
  matches: ['https://www.youtube.com/*'],
  main() {
    registerContentScript(browser, document, (input, init) => fetch(input, init));
  },
});
