/** The slice of the WebExtension APIs this extension uses, so tests can pass fakes. */
export interface StorageArea {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export type MessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean;

export interface ExtensionApi {
  runtime: {
    onMessage: { addListener(listener: MessageListener): void };
    sendMessage(message: unknown): Promise<unknown>;
    openOptionsPage(): Promise<void>;
  };
  tabs: {
    query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<{ id?: number | undefined }[]>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
  };
  storage: { local: StorageArea };
}
