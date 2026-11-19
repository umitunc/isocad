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
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

