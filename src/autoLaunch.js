// Arranque automático al iniciar sesión.
// En el primer arranque de la app instalada se activa solo; después manda
// lo que el usuario elija en el menú (el flag en userData evita re-activarlo).
//
// macOS/Windows usan la API nativa de Electron (setLoginItemSettings).
// Linux NO la soporta, así que se gestiona a mano un archivo .desktop en
// ~/.config/autostart (respetando XDG_CONFIG_HOME).
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const FLAG_FILE = 'autolaunch-configured';

// ---------- flag de primer arranque ----------

function flagPath(userDataDir) {
  return path.join(userDataDir, FLAG_FILE);
}

function isConfigured(userDataDir) {
  try {
    return fs.existsSync(flagPath(userDataDir));
  } catch {
    return false;
  }
}

function markConfigured(userDataDir) {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(flagPath(userDataDir), new Date().toISOString());
}

// ---------- Linux: archivo .desktop de autostart ----------

function linuxDesktopPath() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'autostart', 'claude-usage.desktop');
}

// En un AppImage, process.execPath apunta al montaje temporal; el ejecutable
// real que hay que relanzar está en la variable APPIMAGE.
function linuxExec(execPath) {
  return process.env.APPIMAGE || execPath;
}

function desktopContents(exec) {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Claude Usage',
    `Exec="${exec}"`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n');
}

function writeLinuxAutostart(exec) {
  const file = linuxDesktopPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, desktopContents(exec));
}

function removeLinuxAutostart() {
  try {
    fs.unlinkSync(linuxDesktopPath());
  } catch {}
}

function linuxAutostartEnabled() {
  try {
    return fs.existsSync(linuxDesktopPath());
  } catch {
    return false;
  }
}

// ---------- API común ----------

// `path` solo aplica en Windows (registro Run); macOS lo ignora y usa el .app.
function loginSettings(openAtLogin, execPath) {
  return { openAtLogin, path: execPath };
}

// Aplica el estado de arranque automático en la plataforma actual.
function applyAutoLaunch(app, enabled, execPath, platform) {
  if (platform === 'linux') {
    if (enabled) writeLinuxAutostart(linuxExec(execPath));
    else removeLinuxAutostart();
    return;
  }
  app.setLoginItemSettings(loginSettings(enabled, execPath));
}

// Lee el estado actual del arranque automático, sea cual sea la plataforma.
function isEnabled(app, platform = process.platform) {
  if (platform === 'linux') return linuxAutostartEnabled();
  return app.getLoginItemSettings().openAtLogin;
}

// Activa "iniciar al encender" la primera vez que corre la app instalada.
// En dev (isPackaged=false) no hace nada: registraría el binario de electron.
// Devuelve true si lo activó en esta llamada.
function ensureAutoLaunch(app, execPath = process.execPath, platform = process.platform) {
  if (!app.isPackaged) return false;
  const userData = app.getPath('userData');
  if (isConfigured(userData)) return false;
  applyAutoLaunch(app, true, execPath, platform);
  markConfigured(userData);
  return true;
}

// Cambio manual desde el menú: aplica la preferencia y fija el flag para
// que el primer-arranque nunca pise la decisión del usuario.
function setAutoLaunch(app, enabled, execPath = process.execPath, platform = process.platform) {
  applyAutoLaunch(app, enabled, execPath, platform);
  if (app.isPackaged) markConfigured(app.getPath('userData'));
}

module.exports = {
  ensureAutoLaunch,
  setAutoLaunch,
  isEnabled,
  loginSettings,
  flagPath,
  linuxDesktopPath,
};
