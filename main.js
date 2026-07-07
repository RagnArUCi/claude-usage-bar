// Claude Usage — app de bandeja del sistema, sin ventanas.
// macOS: logo de Claude + "42%" en la barra de menú superior.
// Windows: icono con el número dentro, junto al reloj/batería.
'use strict';

const { app, Tray, Menu } = require('electron');
const { fetchUsage } = require('./src/usage');
const { macTemplateIcon, winPercentIcon } = require('./src/trayIcon');
const { ensureAutoLaunch, setAutoLaunch } = require('./src/autoLaunch');

const POLL_MS = 60 * 1000;
const IS_MAC = process.platform === 'darwin';

let tray = null;
let timer = null;

const ERROR_MESSAGES = {
  'no-credentials':
    'No encontré credenciales de Claude Code. Abre Claude Code e inicia sesión.',
  expired:
    'La sesión de Claude Code expiró. Abre Claude Code para renovarla.',
  network: 'Sin conexión con api.anthropic.com.',
  parse: 'Respuesta inesperada de la API.',
  formato: 'La API devolvió un formato desconocido.',
};

function fmtReset(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const sameDay = d.toDateString() === new Date().toDateString();
  const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return hm;
  const day = d.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
  return `${day} ${hm}`;
}

function statLine(label, stat) {
  if (!stat) return null;
  const reset = fmtReset(stat.resetsAt);
  return `${label}: ${stat.pct}%${reset ? ` · se reinicia ${reset}` : ''}`;
}

function buildMenu(lines) {
  const template = [
    ...lines.map((label) => ({ label, enabled: false })),
    { type: 'separator' },
    { label: 'Actualizar ahora', click: () => refresh() },
    {
      // En dev registraría electron.exe en vez de la app instalada.
      label: app.isPackaged
        ? 'Iniciar al encender el equipo'
        : 'Iniciar al encender el equipo (solo app instalada)',
      type: 'checkbox',
      enabled: app.isPackaged,
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => setAutoLaunch(app, item.checked),
    },
    { type: 'separator' },
    { label: `Claude Usage v${app.getVersion()}`, enabled: false },
    { label: 'Salir', role: 'quit' },
  ];
  return Menu.buildFromTemplate(template);
}

function showError(code) {
  const msg = ERROR_MESSAGES[code] || `Error: ${code}`;
  if (IS_MAC) tray.setTitle(' –');
  else tray.setImage(winPercentIcon('!'));
  tray.setToolTip(`Claude Usage — ${msg}`);
  tray.setContextMenu(buildMenu([msg]));
}

function showUsage(u) {
  const pct = u.session ? u.session.pct : u.weekly.pct;
  if (IS_MAC) tray.setTitle(` ${pct}%`);
  else tray.setImage(winPercentIcon(String(pct), pct));

  const lines = [
    statLine('Sesión actual (5 h)', u.session),
    statLine('Semana (todos los modelos)', u.weekly),
    statLine('Semana (Opus)', u.opus),
  ].filter(Boolean);

  tray.setToolTip(`Claude: ${pct}% usado`);
  tray.setContextMenu(buildMenu(lines));
}

async function refresh() {
  try {
    const u = await fetchUsage();
    if (!tray) return;
    if (u.error) showError(u.error);
    else showUsage(u);
  } catch (err) {
    if (tray) showError('parse');
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    if (IS_MAC && app.dock) app.dock.hide();
    ensureAutoLaunch(app);

    tray = new Tray(IS_MAC ? macTemplateIcon() : winPercentIcon('-'));
    tray.setToolTip('Claude Usage — cargando…');
    if (IS_MAC) tray.setTitle(' …');
    tray.setContextMenu(buildMenu(['Cargando…']));

    refresh();
    timer = setInterval(refresh, POLL_MS);
  });

  // App de solo-bandeja: no salir cuando no hay ventanas.
  app.on('window-all-closed', () => {});
}
