import type { StorageArea } from './platform';

export const MODELS = [
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fast, lowest cost)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (more thorough)' },
] as const;

export type ModelId = (typeof MODELS)[number]['id'];

export const DEFAULT_MODEL: ModelId = 'claude-haiku-5-5';

const API_KEY = 'anthropicApiKey';
const MODEL = 'model';

export interface Settings {
  apiKey: string;
  model: ModelId;
}

export function isModelId(value: unknown): value is ModelId {
  return MODELS.some((model) => model.id === value);
}

export function modelLabel(id: string): string {
  return MODELS.find((model) => model.id === id)?.label ?? id;
}

export async function loadSettings(storage: StorageArea): Promise<Settings> {
  const stored = await storage.get([API_KEY, MODEL]);
  const apiKey = stored[API_KEY];
  const model = stored[MODEL];
  return {
    apiKey: typeof apiKey === 'string' ? apiKey : '',
    model: isModelId(model) ? model : DEFAULT_MODEL,
  };
}

export async function saveApiKey(storage: StorageArea, apiKey: string): Promise<void> {
  await storage.set({ [API_KEY]: apiKey });
}

export async function clearApiKey(storage: StorageArea): Promise<void> {
  await storage.remove(API_KEY);
}

export async function saveModel(storage: StorageArea, model: ModelId): Promise<void> {
  await storage.set({ [MODEL]: model });
}
