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
});

