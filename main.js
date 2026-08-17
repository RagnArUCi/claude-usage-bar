// Claude Usage — app de bandeja del sistema, sin ventanas de escritorio.
// macOS: logo de Claude + "42%" en la barra de menú superior.
// Windows: icono con el número dentro, junto al reloj.
// Al hacer clic se abre un panel con los medidores de cada límite.
'use strict';

const path = require('path');
const {
  app,
  Tray,
  Menu,
  BrowserWindow,
  ipcMain,
  screen,
  nativeTheme,
  systemPreferences,
  powerMonitor,
  Notification,
  shell,
} = require('electron');

const { Poller } = require('./src/poller');
const store = require('./src/store');
const { palette } = require('./src/color');
const { forecast, sparkline } = require('./src/forecast');
const { macTemplateIcon, winPercentIcon } = require('./src/trayIcon');
const { ensureAutoLaunch, setAutoLaunch, isEnabled } = require('./src/autoLaunch');
const { checkForUpdate } = require('./src/updateCheck');

const IS_MAC = process.platform === 'darwin';
const PANEL_WIDTH = 300;
const PANEL_MARGIN = 8;
const UPDATE_POLL_MS = 6 * 60 * 60 * 1000; // cada 6 h

let tray = null;
let panel = null;
let poller = null;
let updateInfo = null; // { latest, url } cuando hay una versión más nueva
let notifiedVersion = null;

/* ---------- Datos para la interfaz ---------- */

/** El límite que manda: el elegido en ajustes o, en automático, el más alto. */
function resolvePrimary(limits, setting) {
  if (!limits.length) return null;
  if (setting && setting !== 'auto') {
    const found = limits.find((l) => l.kind === setting);
    if (found) return found;
  }
  return limits.reduce((a, b) => (b.pct > a.pct ? b : a), limits[0]);
}

function buildPayload() {
  const state = poller.state();
  const settings = store.getSettings();
  const limits = state.limits.map((l) => ({ ...l, fc: forecast(l, state.history) }));
  const primary = resolvePrimary(limits, settings.barMetric);
  const pal = palette();

  return {
    state: {
      status: state.status,
      error: state.error,
      needsLogin: state.needsLogin,
      fetchedAt: state.fetchedAt,
      ageMs: state.ageMs,
      limits,
      spark: primary ? sparkline(state.history, primary.kind) : [],
    },
    settings,
    loginItem: isEnabled(app),
    // En desarrollo se registraría electron en vez de la app instalada.
    canAutoLaunch: app.isPackaged,
    primaryKind: primary ? primary.kind : null,
    palette: {
      accent: nativeTheme.shouldUseDarkColors ? pal.accentDark : pal.accentLight,
      severity: pal.severity,
    },
  };
}

function push() {
  if (panel && !panel.isDestroyed()) {
    panel.webContents.send('payload', buildPayload());
  }
}

/* ---------- Bandeja ---------- */

function updateTray(payload) {
  const { state, primaryKind } = payload;
  const primary = state.limits.find((l) => l.kind === primaryKind) || null;
  const pct = primary ? primary.pct : null;
  const sevColor = primary ? payload.palette.severity[primary.severity] : null;

  if (IS_MAC) {
    tray.setTitle(pct === null ? ' -' : ` ${pct}%`);
  } else {
    tray.setImage(winPercentIcon(pct === null ? '-' : String(pct), sevColor));
  }

  const parts = state.limits.map((l) => `${l.label} ${l.pct} %`);
  let tip = parts.length ? `Claude · ${parts.join(' · ')}` : 'Claude · sin datos todavía';
  if (state.needsLogin) tip += ' · sesión caducada';
  else if (state.status === 'stale') tip += ' · dato no reciente';
  tray.setToolTip(tip);
}

function contextMenu() {
  const items = [];

  if (updateInfo) {
    items.push({
      label: `⬆ Actualización disponible (v${updateInfo.latest})`,
      click: () => shell.openExternal(updateInfo.url),
    });
    items.push({ type: 'separator' });
  }

  items.push(
    { label: 'Abrir panel', click: () => showPanel() },
    { label: 'Actualizar ahora', click: () => poller.refresh({ manual: true }) },
    { label: 'Buscar actualizaciones', click: () => checkUpdates(true) },
    { type: 'separator' },
    {
      // En dev registraría electron.exe en vez de la app instalada.
      label: app.isPackaged
        ? 'Iniciar al encender el equipo'
        : 'Iniciar al encender el equipo (solo app instalada)',
      type: 'checkbox',
      enabled: app.isPackaged,
      checked: isEnabled(app),
      click: (item) => {
        setAutoLaunch(app, item.checked);
        push();
      },
    },
    { type: 'separator' },
    { label: `Claude Usage v${app.getVersion()}`, enabled: false },
    { label: 'Salir', role: 'quit' },
  );

  return Menu.buildFromTemplate(items);
}

// Comprueba si hay una versión nueva. `manual` = lo pidió el usuario desde el
// menú (avisa aunque ya esté al día). Automático: solo avisa una vez por
// versión para no repetir la notificación cada 6 h.
async function checkUpdates(manual = false) {
  const r = await checkForUpdate(app.getVersion());
  if (!r || r.error) {
    if (manual && Notification.isSupported()) {
      new Notification({
        title: 'Claude Usage',
        body: 'No pude comprobar actualizaciones ahora mismo.',
      }).show();
    }
    return;
  }

  if (!r.updateAvailable) {
    updateInfo = null;
    if (manual && Notification.isSupported()) {
      new Notification({
        title: 'Claude Usage',
        body: `Ya tienes la última versión (v${app.getVersion()}).`,
      }).show();
    }
    return;
  }

  updateInfo = { latest: r.latest, url: r.url };

  if ((manual || notifiedVersion !== r.latest) && Notification.isSupported()) {
    notifiedVersion = r.latest;
    const n = new Notification({
      title: 'Claude Usage — actualización disponible',
      body: `La versión ${r.latest} ya está lista. Clic para descargarla.`,
    });
    n.on('click', () => shell.openExternal(updateInfo.url));
    n.show();
  }
}

/* ---------- Panel ---------- */

function createPanel() {
  panel = new BrowserWindow({
    width: PANEL_WIDTH,
    height: 420,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // Sin vibrancia: combinada con `transparent: true` no llega a pintar y la
    // tarjeta se queda viendo el escritorio. La tarjeta pone su propio fondo.
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  panel.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  panel.loadFile(path.join(__dirname, 'src', 'panel', 'index.html'));
  panel.on('blur', () => {
    if (!panel.webContents.isDevToolsOpened()) hidePanel();
  });
}

function positionPanel() {
  const trayBounds = tray.getBounds();
  const { width, height } = panel.getBounds();
  const anchor = trayBounds.width
    ? { x: trayBounds.x + trayBounds.width / 2, y: trayBounds.y }
    : screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(anchor).workArea;

  let x = Math.round(anchor.x - width / 2);
  let y;
  if (IS_MAC) {
    y = Math.round(trayBounds.y + trayBounds.height + 6);
  } else {
    // En Windows la bandeja suele estar abajo a la derecha, pero la barra de
    // tareas puede estar en cualquier borde: se ancla al área de trabajo.
    const trayAtTop = trayBounds.height && trayBounds.y < area.y + area.height / 2;
    y = trayAtTop
      ? Math.round(area.y + PANEL_MARGIN)
      : Math.round(area.y + area.height - height - PANEL_MARGIN);
    if (!trayBounds.width) x = Math.round(area.x + area.width - width - PANEL_MARGIN);
  }

  x = Math.max(area.x + PANEL_MARGIN, Math.min(x, area.x + area.width - width - PANEL_MARGIN));
  y = Math.max(area.y + PANEL_MARGIN, y);
  panel.setPosition(x, y, false);
}

function showPanel() {
  if (!panel || panel.isDestroyed()) return;
  positionPanel();
  panel.show();
  panel.focus();
  poller.setPanelOpen(true);
}

function hidePanel() {
  if (!panel || panel.isDestroyed() || !panel.isVisible()) return;
  panel.hide();
  poller.setPanelOpen(false);
}

function togglePanel() {
  if (panel && panel.isVisible()) hidePanel();
  else showPanel();
}

/* ---------- Avisos ---------- */

function resetPhrase(iso) {
  if (!iso) return '';
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return '';
  const dt = at - Date.now();
  if (dt <= 0) return '';
  if (dt < 24 * 3600 * 1000) {
    const min = Math.round(dt / 60000);
    const h = Math.floor(min / 60);
    const m = min % 60;
    const dur = h ? (m ? `${h} h ${m} min` : `${h} h`) : `${min} min`;
    return ` Se reinicia en ${dur}.`;
  }
  const d = new Date(at);
  return ` Se reinicia el ${d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}.`;
}

/**
 * Avisa una sola vez por umbral y por ventana: la clave incluye `resets_at`,
 * así el aviso se rearma solo cuando empieza una ventana nueva.
 */
function checkThresholds(limits) {
  const settings = store.getSettings();
  if (!settings.notifyThresholds || !Notification.isSupported()) return;
  const seen = store.getNotified();

  for (const l of limits) {
    const crossed = settings.thresholds
      .filter((t) => l.pct >= t)
      .sort((a, b) => a - b)
      .filter((t) => !seen[`${l.kind}:${l.resetsAt}:${t}`]);
    if (!crossed.length) continue;

    // Se marcan todos los cruzados pero solo se notifica el más alto, para
    // no lanzar dos avisos seguidos si se pasa del 80 % al 95 % de golpe.
    for (const t of crossed) store.markNotified(`${l.kind}:${l.resetsAt}:${t}`);

    new Notification({
      title: `Claude · ${l.label} al ${l.pct} %`,
      body: `Has cruzado el ${crossed[crossed.length - 1]} % de tu límite.${resetPhrase(l.resetsAt)}`,
      silent: false,
    }).show();
  }
}

/* ---------- Arranque ---------- */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showPanel());

  app.whenReady().then(() => {
    if (IS_MAC && app.dock) app.dock.hide();
    ensureAutoLaunch(app);

    tray = new Tray(IS_MAC ? macTemplateIcon() : winPercentIcon('-', null));
    tray.setToolTip('Claude Usage — cargando…');
    if (IS_MAC) tray.setTitle(' …');
    tray.on('click', togglePanel);
    tray.on('right-click', () => tray.popUpContextMenu(contextMenu()));

    createPanel();

    poller = new Poller();
    poller.on('update', (state) => {
      const payload = buildPayload();
      updateTray(payload);
      push();
      if (state.status === 'ok') checkThresholds(payload.state.limits);
    });
    poller.start();

    // Comprobación de actualizaciones: al arrancar y cada 6 h.
    checkUpdates();
    setInterval(() => checkUpdates(), UPDATE_POLL_MS);

    // Al despertar el equipo el dato suele estar viejo: se refresca ya.
    powerMonitor.on('resume', () => poller.refresh());
    powerMonitor.on('unlock-screen', () => poller.refresh());

    nativeTheme.on('updated', push);
    try {
      systemPreferences.on('accent-color-changed', push);
    } catch {
      // No disponible en todas las plataformas.
    }

    ipcMain.on('request-payload', push);
    ipcMain.on('refresh', () => poller.refresh({ manual: true }));
    ipcMain.on('set-setting', (_e, { key, value }) => {
      store.setSetting(key, value);
      updateTray(buildPayload());
      push();
    });
    ipcMain.on('set-login-item', (_e, enabled) => {
      setAutoLaunch(app, !!enabled);
      push();
    });
    ipcMain.on('resize', (_e, height) => {
      if (!panel || panel.isDestroyed()) return;
      const h = Math.max(160, Math.min(700, Math.round(height)));
      if (panel.getBounds().height === h) return;
      panel.setBounds({ width: PANEL_WIDTH, height: h }, false);
      if (panel.isVisible()) positionPanel();
    });
  });

  // App de solo-bandeja: no salir cuando no hay ventanas visibles.
  app.on('window-all-closed', () => {});
}
