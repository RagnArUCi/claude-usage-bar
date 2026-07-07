'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  ensureAutoLaunch,
  setAutoLaunch,
  loginSettings,
  flagPath,
} = require('../src/autoLaunch');

let userData;

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-usage-bar-test-'));
});

afterEach(() => {
  fs.rmSync(userData, { recursive: true, force: true });
});

function fakeApp({ isPackaged = true } = {}) {
  const calls = [];
  return {
    isPackaged,
    calls,
    getPath: (name) => {
      assert.equal(name, 'userData');
      return userData;
    },
    setLoginItemSettings: (opts) => calls.push(opts),
  };
}

test('primer arranque empaquetado: activa openAtLogin y deja el flag', () => {
  const app = fakeApp();
  const enabled = ensureAutoLaunch(app, 'C:\\Apps\\Claude Usage.exe');

  assert.equal(enabled, true);
  assert.deepEqual(app.calls, [
    { openAtLogin: true, path: 'C:\\Apps\\Claude Usage.exe' },
  ]);
  assert.ok(fs.existsSync(flagPath(userData)));
});

test('segundo arranque: no vuelve a tocar la configuración', () => {
  const app = fakeApp();
  ensureAutoLaunch(app, 'x.exe');
  const enabled = ensureAutoLaunch(app, 'x.exe');

  assert.equal(enabled, false);
  assert.equal(app.calls.length, 1);
});

test('modo dev (isPackaged=false): no hace nada', () => {
  const app = fakeApp({ isPackaged: false });
  const enabled = ensureAutoLaunch(app, 'electron.exe');

  assert.equal(enabled, false);
  assert.equal(app.calls.length, 0);
  assert.equal(fs.existsSync(flagPath(userData)), false);
});

test('si el usuario lo desactiva, el primer-arranque no lo pisa', () => {
  const app = fakeApp();
  setAutoLaunch(app, false, 'x.exe'); // usuario desactiva antes que ensureAutoLaunch
  const enabled = ensureAutoLaunch(app, 'x.exe');

  assert.equal(enabled, false);
  assert.deepEqual(app.calls, [{ openAtLogin: false, path: 'x.exe' }]);
});

test('setAutoLaunch aplica el cambio manual y fija el flag', () => {
  const app = fakeApp();
  setAutoLaunch(app, true, 'x.exe');

  assert.deepEqual(app.calls, [{ openAtLogin: true, path: 'x.exe' }]);
  assert.ok(fs.existsSync(flagPath(userData)));
});

test('crea userData si no existe todavía', () => {
  const app = fakeApp();
  const nested = path.join(userData, 'no', 'existe');
  app.getPath = () => nested;

  assert.equal(ensureAutoLaunch(app, 'x.exe'), true);
  assert.ok(fs.existsSync(flagPath(nested)));
});

test('loginSettings incluye siempre el path del ejecutable', () => {
  assert.deepEqual(loginSettings(true, '/a/b'), { openAtLogin: true, path: '/a/b' });
  assert.deepEqual(loginSettings(false, '/a/b'), { openAtLogin: false, path: '/a/b' });
});
