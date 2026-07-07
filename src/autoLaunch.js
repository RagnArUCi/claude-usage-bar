// Arranque automático al iniciar sesión.
// En el primer arranque de la app instalada se activa solo; después manda
// lo que el usuario elija en el menú (el flag en userData evita re-activarlo).
'use strict';

const fs = require('fs');
const path = require('path');

const FLAG_FILE = 'autolaunch-configured';

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

// `path` solo aplica en Windows (registro Run); macOS lo ignora y usa el .app.
function loginSettings(openAtLogin, execPath) {
  return { openAtLogin, path: execPath };
}

// Activa "iniciar al encender" la primera vez que corre la app instalada.
// En dev (isPackaged=false) no hace nada: registraría electron.exe.
// Devuelve true si lo activó en esta llamada.
function ensureAutoLaunch(app, execPath = process.execPath) {
  if (!app.isPackaged) return false;
  const userData = app.getPath('userData');
  if (isConfigured(userData)) return false;
  app.setLoginItemSettings(loginSettings(true, execPath));
  markConfigured(userData);
  return true;
}

// Cambio manual desde el menú: aplica la preferencia y fija el flag para
// que el primer-arranque nunca pise la decisión del usuario.
function setAutoLaunch(app, enabled, execPath = process.execPath) {
  app.setLoginItemSettings(loginSettings(enabled, execPath));
  if (app.isPackaged) markConfigured(app.getPath('userData'));
}

module.exports = { ensureAutoLaunch, setAutoLaunch, loginSettings, flagPath };
