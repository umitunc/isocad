export interface ElectronAppInfo {
  name: string;
  version: string;
  isPackaged: boolean;
  platform: string;
  isWindowsStore: boolean;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  isWindowsStore: boolean;
  getAppInfo: () => Promise<ElectronAppInfo>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

