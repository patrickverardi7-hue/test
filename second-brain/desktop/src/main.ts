// App desktop di Second Brain.
// - avvia il server locale (API + interfaccia) e lo tiene acceso finché l'app è in esecuzione
// - resta nella barra di sistema quando chiudi la finestra: promemoria, MCP per Claude e API restano attivi
// - scorciatoia globale Ctrl/Cmd+Shift+Spazio per la cattura rapida da qualsiasi programma
// - si avvia da sola all'accesso al computer (disattivabile dal menu dell'icona)
import { app, BrowserWindow, dialog, globalShortcut, Menu, nativeImage, Notification, shell, Tray, utilityProcess, type UtilityProcess } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';

const DATA_DIR = process.env.SECOND_BRAIN_HOME ?? path.join(os.homedir(), 'SecondBrain');
fs.mkdirSync(DATA_DIR, { recursive: true });

let fileEnv: Record<string, string | undefined> = {};
try {
  fileEnv = parseEnv(fs.readFileSync(path.join(DATA_DIR, '.env'), 'utf8'));
} catch {
  /* nessun file .env */
}

const PORT = Number(process.env.PORT ?? fileEnv.PORT ?? 3001);
const APP_URL = `http://127.0.0.1:${PORT}`;
const SHORTCUT = 'CommandOrControl+Shift+Space';
const isDev = !app.isPackaged;
const unpacked = (p: string) => p.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
const SERVER_PATH = unpacked(path.join(__dirname, 'server.mjs'));
const BUNDLED_MCP = unpacked(path.join(__dirname, 'second-brain-mcp.mjs'));
const CLIENT_DIST = isDev ? path.resolve(__dirname, '../../client/dist') : path.join(process.resourcesPath, 'client');
const ASSETS = path.join(__dirname, '../assets');
const LOG_FILE = path.join(DATA_DIR, 'desktop.log');
const SETTINGS_FILE = path.join(DATA_DIR, 'desktop-settings.json');
// Installata: copia il server MCP nella cartella dati, così il percorso da dare a Claude resta stabile
// anche tra aggiornamenti e con l'AppImage (che a ogni avvio è montata in una cartella temporanea diversa).
const MCP_PATH = isDev ? BUNDLED_MCP : stableMcpPath();

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let serverProc: UtilityProcess | ChildProcess | null = null;

function log(...args: unknown[]) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${args.map(String).join(' ')}\n`);
  } catch {
    /* ignora */
  }
}

function stableMcpPath(): string {
  const target = path.join(DATA_DIR, 'second-brain-mcp.mjs');
  try {
    fs.copyFileSync(BUNDLED_MCP, target);
    return target;
  } catch (e) {
    log('Copia del server MCP non riuscita:', e);
    return BUNDLED_MCP;
  }
}

type DesktopSettings = { firstRunDone?: boolean; hideNoticeShown?: boolean };
function readSettings(): DesktopSettings {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}
function writeSettings(patch: DesktopSettings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ ...readSettings(), ...patch }, null, 2));
}

// ---------------- server ----------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function isUp(): Promise<boolean> {
  try {
    const r = await fetch(`${APP_URL}/api/health`, { signal: AbortSignal.timeout(1000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function waitUp(ms: number, failed: () => boolean): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end && !failed()) {
    if (await isUp()) return true;
    await sleep(250);
  }
  return false;
}

async function startServer(): Promise<boolean> {
  if (await isUp()) {
    log(`Server già attivo su ${APP_URL}: mi collego a quello`);
    return true;
  }
  const env = {
    ...process.env,
    PORT: String(PORT),
    CLIENT_DIST,
    MCP_PATH,
    SECOND_BRAIN_DESKTOP: '1',
    SECOND_BRAIN_HOME: DATA_DIR,
  } as Record<string, string>;
  const cwd = isDev ? path.resolve(__dirname, '../../server') : DATA_DIR;

  // 1) runtime Node integrato in Electron
  let exited = false;
  try {
    const child = utilityProcess.fork(SERVER_PATH, [], { env, cwd, stdio: 'pipe', serviceName: 'Second Brain server' });
    child.stdout?.on('data', (d) => log('[server]', String(d).trim()));
    child.stderr?.on('data', (d) => log('[server]', String(d).trim()));
    child.on('exit', (code) => {
      exited = true;
      log('Server (Electron) terminato con codice', code);
    });
    serverProc = child;
    if (await waitUp(10_000, () => exited)) return true;
    if (!exited) child.kill();
  } catch (e) {
    log('utilityProcess non disponibile:', e);
  }

  // 2) Node.js installato nel sistema (serve Node 22.13+)
  log('Avvio il server con Node.js di sistema');
  const extraPath = ['/usr/local/bin', '/opt/homebrew/bin', path.join(os.homedir(), '.volta/bin')].join(path.delimiter);
  let failed = false;
  const child = spawn('node', [SERVER_PATH], {
    env: { ...env, PATH: `${process.env.PATH ?? ''}${path.delimiter}${extraPath}` },
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout?.on('data', (d) => log('[server]', String(d).trim()));
  child.stderr?.on('data', (d) => log('[server]', String(d).trim()));
  child.on('error', (e) => {
    failed = true;
    log('Node.js di sistema non trovato:', e.message);
  });
  child.on('exit', (code) => {
    failed = true;
    log('Server (node) terminato con codice', code);
  });
  serverProc = child;
  return waitUp(10_000, () => failed);
}

function stopServer() {
  if (!serverProc) return;
  try {
    serverProc.kill();
  } catch {
    /* già chiuso */
  }
  serverProc = null;
}

// ---------------- finestra ----------------
function createWindow(show: boolean) {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 380,
    minHeight: 500,
    title: 'Second Brain',
    icon: path.join(ASSETS, 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#111118',
    webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true },
  });
  win.loadURL(APP_URL);
  win.once('ready-to-show', () => show && win?.show());

  // chiudere la finestra la nasconde: l'app resta attiva nella barra di sistema
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win?.hide();
    if (!readSettings().hideNoticeShown && Notification.isSupported()) {
      new Notification({
        title: 'Second Brain è ancora attivo',
        body: 'Lo trovi nella barra di sistema. Premi Ctrl/Cmd+Shift+Spazio per catturare qualcosa al volo.',
      }).show();
      writeSettings({ hideNoticeShown: true });
    }
  });

  // link esterni (notizie, ispirazioni) nel browser predefinito
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url) && !url.startsWith(APP_URL)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(APP_URL)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  win.webContents.on('did-fail-load', () => setTimeout(() => win?.loadURL(APP_URL), 1500));
}

function showWindow(hash?: string) {
  if (!win || win.isDestroyed()) createWindow(true);
  if (hash) win!.webContents.executeJavaScript(`location.hash = ${JSON.stringify(hash)}`).catch(() => undefined);
  if (win!.isMinimized()) win!.restore();
  win!.show();
  win!.focus();
}

function quickCapture() {
  showWindow();
  // apre la cattura rapida restando sulla pagina corrente
  win?.webContents
    .executeJavaScript(`(function(){var p=(location.hash.split('?')[0]||'#/');location.hash=p+'?capture='+Date.now();})()`)
    .catch(() => undefined);
}

// ---------------- avvio automatico ----------------
const loginArgs = () => (isDev ? [app.getAppPath(), '--hidden'] : ['--hidden']);
const linuxAutostartFile = path.join(os.homedir(), '.config', 'autostart', 'second-brain.desktop');

function getAutoStart(): boolean {
  if (process.platform === 'linux') return fs.existsSync(linuxAutostartFile);
  return app.getLoginItemSettings({ args: loginArgs() }).openAtLogin;
}

function setAutoStart(enabled: boolean) {
  if (process.platform === 'linux') {
    if (enabled) {
      fs.mkdirSync(path.dirname(linuxAutostartFile), { recursive: true });
      const exec = [process.env.APPIMAGE ?? process.execPath, ...loginArgs()].map((a) => `"${a}"`).join(' ');
      fs.writeFileSync(linuxAutostartFile, `[Desktop Entry]\nType=Application\nName=Second Brain\nExec=${exec}\nX-GNOME-Autostart-enabled=true\n`);
    } else fs.rmSync(linuxAutostartFile, { force: true });
    return;
  }
  app.setLoginItemSettings({ openAtLogin: enabled, args: loginArgs() });
}

// ---------------- icona nella barra di sistema ----------------
function trayIcon() {
  if (process.platform === 'darwin') {
    const img = nativeImage.createFromPath(path.join(ASSETS, 'trayTemplate.png'));
    img.setTemplateImage(true);
    return img;
  }
  return nativeImage.createFromPath(path.join(ASSETS, 'tray.png'));
}

function buildTrayMenu() {
  const shortcut = process.platform === 'darwin' ? '⌘⇧Spazio' : 'Ctrl+Shift+Spazio';
  return Menu.buildFromTemplate([
    { label: 'Apri Second Brain', click: () => showWindow() },
    { label: `Cattura rapida (${shortcut})`, click: quickCapture },
    { type: 'separator' },
    { label: '🏠 Oggi', click: () => showWindow('#/') },
    { label: '🛒 Lista della spesa', click: () => showWindow('#/spesa') },
    { label: '🏋️ Allenamenti', click: () => showWindow('#/allenamenti') },
    { label: '🎬 Idee video', click: () => showWindow('#/social') },
    { label: '✨ Assistente', click: () => showWindow('#/assistente') },
    { type: 'separator' },
    {
      label: "Avvia all'accesso al computer",
      type: 'checkbox',
      checked: getAutoStart(),
      click: (item) => {
        setAutoStart(item.checked);
        tray?.setContextMenu(buildTrayMenu());
      },
    },
    { label: 'Collega Claude (MCP)…', click: () => showWindow('#/impostazioni') },
    { label: 'Apri cartella dati', click: () => shell.openPath(DATA_DIR) },
    { type: 'separator' },
    {
      label: 'Esci da Second Brain',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Second Brain');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => (win?.isVisible() && win.isFocused() ? win.hide() : showWindow()));
}

// ---------------- ciclo di vita ----------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.secondbrain.desktop');
    Menu.setApplicationMenu(null);
    log(`Avvio (${isDev ? 'sviluppo' : 'installata'}) — dati in ${DATA_DIR}`);

    const settings = readSettings();
    if (!settings.firstRunDone) {
      // al primo avvio attiva l'avvio automatico (si può disattivare dal menu)
      try {
        setAutoStart(true);
      } catch (e) {
        log('Avvio automatico non attivato:', e);
      }
      writeSettings({ firstRunDone: true });
    }

    const ok = await startServer();
    if (!ok) {
      dialog.showErrorBox(
        'Second Brain non riesce ad avviarsi',
        `Il server interno non è partito. Controlla che la porta ${PORT} sia libera e che Node.js 22.13+ sia installato.\n\nDettagli nel file:\n${LOG_FILE}`,
      );
      quitting = true;
      app.quit();
      return;
    }

    const startHidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAtLogin;
    createTray();
    createWindow(!startHidden);

    if (!globalShortcut.register(SHORTCUT, quickCapture)) log(`Scorciatoia ${SHORTCUT} già usata da un altro programma`);
  });

  app.on('activate', () => showWindow());
  // non chiudere l'app quando non ci sono finestre: resta nella barra di sistema
  app.on('window-all-closed', () => undefined);
  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    stopServer();
  });
}
