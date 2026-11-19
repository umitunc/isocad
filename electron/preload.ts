import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAppInfo {
  name: string;
  version: string;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  isWindowsStore: boolean;
}

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  isWindowsStore: Boolean((process as NodeJS.Process & { windowsStore?: boolean }).windowsStore),
  getAppInfo: (): Promise<ElectronAppInfo> => ipcRenderer.invoke('app:get-info'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:open-external', url),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: (): Promise<void> => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isWindowMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
  onWindowMaximizedChange: (callback: (maximized: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized);
    ipcRenderer.on('window:maximized-changed', listener);
    return () => {
      ipcRenderer.removeListener('window:maximized-changed', listener);
    };
  },
});

