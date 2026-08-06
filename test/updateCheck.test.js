'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  checkForUpdate,
  compareVersions,
  isNewer,
} = require('../src/updateCheck');

// ---------- comparación de versiones (espacio determinista) ----------

test('compareVersions ordena por major/minor/patch', () => {
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions('1.2.4', '1.2.3'), 1);
  assert.equal(compareVersions('1.3.0', '1.2.9'), 1);
  assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.2.3', '1.2.4'), -1);
});

test('compareVersions ignora el prefijo v y espacios', () => {
  assert.equal(compareVersions('v1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions(' v2.0.0 ', '1.0.0'), 1);
});

test('compareVersions tolera versiones incompletas', () => {
  assert.equal(compareVersions('1.2', '1.2.0'), 0);
  assert.equal(compareVersions('1', '1.0.1'), -1);
});

test('isNewer solo es true si la remota supera a la actual', () => {
  assert.equal(isNewer('1.0.1', '1.0.0'), true);
  assert.equal(isNewer('1.0.0', '1.0.0'), false);
  assert.equal(isNewer('0.9.9', '1.0.0'), false);
});

// ---------- checkForUpdate con fetch simulado ----------

function fakeFetch(response) {
  return async () => response;
}

function okJson(body) {
  return { ok: true, status: 200, json: async () => body };
}

test('detecta actualización cuando el tag es más nuevo', async () => {
  const r = await checkForUpdate(
    '1.0.0',
    fakeFetch(okJson({ tag_name: 'v1.1.0', html_url: 'https://example/rel' })),
  );
  assert.equal(r.updateAvailable, true);
  assert.equal(r.latest, '1.1.0');
  assert.equal(r.url, 'https://example/rel');
});

test('no marca actualización si ya estás al día', async () => {
  const r = await checkForUpdate(
    '1.1.0',
    fakeFetch(okJson({ tag_name: 'v1.1.0' })),
  );
  assert.equal(r.updateAvailable, false);
  assert.equal(r.latest, '1.1.0');
});

test('error de red se reporta sin lanzar', async () => {
  const r = await checkForUpdate('1.0.0', async () => {
    throw new Error('offline');
  });
  assert.equal(r.error, 'network');
});

test('respuesta HTTP no-ok se reporta con el código', async () => {
  const r = await checkForUpdate(
    '1.0.0',
    fakeFetch({ ok: false, status: 404, json: async () => ({}) }),
  );
  assert.equal(r.error, 'http-404');
});

test('JSON inesperado (sin tag_name) devuelve error de formato', async () => {
  const r = await checkForUpdate('1.0.0', fakeFetch(okJson({})));
  assert.equal(r.error, 'formato');
});

test('cuerpo no parseable devuelve error de parse', async () => {
  const r = await checkForUpdate(
    '1.0.0',
    fakeFetch({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json');
      },
    }),
  );
  assert.equal(r.error, 'parse');
});
