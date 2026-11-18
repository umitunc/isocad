import { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const APP_SCHEME = 'app';
const APP_HOST = 'isocad';
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// Register custom scheme before app is ready so WebGL2, localStorage, IndexedDB,
// Web Workers (pdf.worker.min.js) and BrowserRouter work identically to HTTPS.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;

function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function resolveDistFile(requestUrl: string): string {
  const url = new URL(requestUrl);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const candidate = path.resolve(DIST_DIR, `.${path.sep}${normalized}`);

  // Prevent path traversal outside dist/
  if (!candidate.startsWith(DIST_DIR)) {
    return path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  // SPA fallback for BrowserRouter routes (/editor, /demo, /docs)
  return path.join(DIST_DIR, 'index.html');
}

function registerAppProtocol(): void {
  protocol.handle(APP_SCHEME, (request) => {
    const filePath = resolveDistFile(request.url);
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function buildMenu(): Menu {
  const isDev = Boolean(DEV_SERVER_URL);

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Editor',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            if (!mainWindow) return;
            const target = DEV_SERVER_URL ? `${DEV_SERVER_URL}/editor` : `${APP_SCHEME}://${APP_HOST}/editor`;
            void mainWindow.loadURL(target);
          },
        },
        {
          label: 'Home',
          click: () => {
            if (!mainWindow) return;
            const target = DEV_SERVER_URL ? DEV_SERVER_URL : `${APP_SCHEME}://${APP_HOST}/`;
            void mainWindow.loadURL(target);
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'IsoCad Documentation',
          click: () => {
            if (!mainWindow) return;
            const target = DEV_SERVER_URL ? `${DEV_SERVER_URL}/docs` : `${APP_SCHEME}://${APP_HOST}/docs`;
            void mainWindow.loadURL(target);
          },
        },
        {
          label: 'Trunçgil Teknoloji',
          click: () => {
            void shell.openExternal('https://truncgil.com');
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

function createMainWindow(): void {
  const iconPath = path.resolve(__dirname, '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'IsoCad — WebGL2 CAD & Piping PDF Editor',
    backgroundColor: '#060913',
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (DEV_SERVER_URL) {
    void mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    void mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/`);
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (!DEV_SERVER_URL) {
      registerAppProtocol();
    }

    Menu.setApplicationMenu(buildMenu());

    ipcMain.handle('app:get-info', () => ({
      name: app.getName(),
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      platform: process.platform,
      isWindowsStore: Boolean((process as NodeJS.Process & { windowsStore?: boolean }).windowsStore),
    }));

    ipcMain.handle('app:open-external', (_event, url: string) => {
      if (typeof url === 'string' && isSafeExternalUrl(url)) {
        return shell.openExternal(url);
      }
      return undefined;
    });

    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

