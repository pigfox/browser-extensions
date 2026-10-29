import { browser } from 'wxt/browser';
import { renderOptions } from '../../src/options';

void renderOptions(document.body, browser.storage.local);
