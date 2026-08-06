'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  ensureAutoLaunch,
  setAutoLaunch,
  isEnabled,
  loginSettings,
  flagPath,
  linuxDesktopPath,
} = require('../src/autoLaunch');

let userData;
let xdg;
let prevXdg;

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-usage-bar-test-'));
  // Aísla el .desktop de autostart de Linux en un XDG_CONFIG_HOME temporal.
  xdg = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-usage-xdg-'));
  prevXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = xdg;
});

afterEach(() => {
  fs.rmSync(userData, { recursive: true, force: true });
  fs.rmSync(xdg, { recursive: true, force: true });
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;
});

function fakeApp({ isPackaged = true, openAtLogin = false } = {}) {
  const calls = [];
  return {
    isPackaged,
    calls,
    _openAtLogin: openAtLogin,
    getPath: (name) => {
      assert.equal(name, 'userData');
      return userData;
    },
    setLoginItemSettings: (opts) => {
      calls.push(opts);
    },
    getLoginItemSettings: function getLogin() {
      return { openAtLogin: this._openAtLogin };
    },
  };
}

// ---------- macOS / Windows (API nativa de Electron) ----------

test('win/mac primer arranque: activa openAtLogin y deja el flag', () => {
  const app = fakeApp();
  const enabled = ensureAutoLaunch(app, 'C:\\Apps\\Claude Usage.exe', 'win32');

  assert.equal(enabled, true);
  assert.deepEqual(app.calls, [
    { openAtLogin: true, path: 'C:\\Apps\\Claude Usage.exe' },
  ]);
  assert.ok(fs.existsSync(flagPath(userData)));
});

test('win/mac segundo arranque: no vuelve a tocar la configuración', () => {
  const app = fakeApp();
  ensureAutoLaunch(app, 'x.exe', 'win32');
  const enabled = ensureAutoLaunch(app, 'x.exe', 'win32');

  assert.equal(enabled, false);
  assert.equal(app.calls.length, 1);
});

test('modo dev (isPackaged=false): no hace nada', () => {
  const app = fakeApp({ isPackaged: false });
  const enabled = ensureAutoLaunch(app, 'electron.exe', 'win32');

  assert.equal(enabled, false);
  assert.equal(app.calls.length, 0);
  assert.equal(fs.existsSync(flagPath(userData)), false);
});

test('win/mac: si el usuario lo desactiva, el primer-arranque no lo pisa', () => {
  const app = fakeApp();
  setAutoLaunch(app, false, 'x.exe', 'win32');
  const enabled = ensureAutoLaunch(app, 'x.exe', 'win32');

  assert.equal(enabled, false);
  assert.deepEqual(app.calls, [{ openAtLogin: false, path: 'x.exe' }]);
});

test('win/mac: setAutoLaunch aplica el cambio manual y fija el flag', () => {
  const app = fakeApp();
  setAutoLaunch(app, true, 'x.exe', 'win32');

  assert.deepEqual(app.calls, [{ openAtLogin: true, path: 'x.exe' }]);
  assert.ok(fs.existsSync(flagPath(userData)));
});

test('win/mac: isEnabled lee getLoginItemSettings', () => {
  assert.equal(isEnabled(fakeApp({ openAtLogin: true }), 'win32'), true);
  assert.equal(isEnabled(fakeApp({ openAtLogin: false }), 'win32'), false);
});

test('crea userData si no existe todavía', () => {
  const app = fakeApp();
  const nested = path.join(userData, 'no', 'existe');
  app.getPath = () => nested;

  assert.equal(ensureAutoLaunch(app, 'x.exe', 'win32'), true);
  assert.ok(fs.existsSync(flagPath(nested)));
});

test('loginSettings incluye siempre el path del ejecutable', () => {
  assert.deepEqual(loginSettings(true, '/a/b'), { openAtLogin: true, path: '/a/b' });
  assert.deepEqual(loginSettings(false, '/a/b'), { openAtLogin: false, path: '/a/b' });
});

// ---------- Linux (.desktop en ~/.config/autostart) ----------

test('linux primer arranque: escribe el .desktop y deja el flag', () => {
  const app = fakeApp();
  const enabled = ensureAutoLaunch(app, '/opt/claude/claude-usage', 'linux');

  assert.equal(enabled, true);
  assert.equal(app.calls.length, 0); // no usa la API nativa
  const desktop = linuxDesktopPath();
  assert.ok(fs.existsSync(desktop));
  const body = fs.readFileSync(desktop, 'utf8');
  assert.match(body, /^\[Desktop Entry\]/);
  assert.match(body, /Exec="\/opt\/claude\/claude-usage"/);
  assert.ok(fs.existsSync(flagPath(userData)));
});

test('linux: isEnabled refleja si existe el .desktop', () => {
  const app = fakeApp();
  assert.equal(isEnabled(app, 'linux'), false);
  ensureAutoLaunch(app, '/opt/claude/claude-usage', 'linux');
  assert.equal(isEnabled(app, 'linux'), true);
});

test('linux: desactivar borra el .desktop', () => {
  const app = fakeApp();
  setAutoLaunch(app, true, '/opt/claude/claude-usage', 'linux');
  assert.equal(isEnabled(app, 'linux'), true);

  setAutoLaunch(app, false, '/opt/claude/claude-usage', 'linux');
  assert.equal(isEnabled(app, 'linux'), false);
  assert.equal(fs.existsSync(linuxDesktopPath()), false);
});

test('linux: usa APPIMAGE como Exec cuando está definido', () => {
  const prev = process.env.APPIMAGE;
  process.env.APPIMAGE = '/home/u/Apps/Claude Usage.AppImage';
  try {
    const app = fakeApp();
    setAutoLaunch(app, true, '/tmp/mount/claude-usage', 'linux');
    const body = fs.readFileSync(linuxDesktopPath(), 'utf8');
    assert.match(body, /Exec="\/home\/u\/Apps\/Claude Usage\.AppImage"/);
  } finally {
    if (prev === undefined) delete process.env.APPIMAGE;
    else process.env.APPIMAGE = prev;
  }
});

test('linux: desactivar cuando no había .desktop no lanza error', () => {
  const app = fakeApp();
  setAutoLaunch(app, false, '/opt/claude/claude-usage', 'linux');
  assert.equal(isEnabled(app, 'linux'), false);
});
