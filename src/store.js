// Estado persistente: ajustes, última lectura buena e historial.
// El historial permite dibujar la tendencia y proyectar cuándo se agota
// la sesión al ritmo actual.
'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const HISTORY_DAYS = 8;
const MIN_SAMPLE_GAP_MS = 60 * 1000; // no guardar más de 1 muestra por minuto
const MAX_SAMPLES = 4000;

const DEFAULTS = {
  barMetric: 'auto', // 'auto' | kind concreto ('session', 'weekly_all'…)
  notifyThresholds: true,
  thresholds: [80, 95],
};

function filePath(name) {
  return path.join(app.getPath('userData'), name);
}

function readJSON(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath(name), 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(name, value) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(filePath(name), JSON.stringify(value));
  } catch {
    // Persistir es best-effort: si falla, la app sigue con el estado en memoria.
  }
}

let settings = null;
let cache = null;
let history = null;
let notified = null;

function getSettings() {
  if (!settings) settings = { ...DEFAULTS, ...readJSON('settings.json', {}) };
  return settings;
}

function setSetting(key, value) {
  if (!(key in DEFAULTS)) return getSettings();
  settings = { ...getSettings(), [key]: value };
  writeJSON('settings.json', settings);
  return settings;
}

/** Última lectura correcta, para poder mostrar algo aunque la API falle. */
function getCache() {
  if (cache === null) cache = readJSON('cache.json', null);
  return cache;
}

function setCache(snapshot) {
  cache = snapshot;
  writeJSON('cache.json', snapshot);
}

function getHistory() {
  if (!history) {
    const raw = readJSON('history.json', []);
    history = Array.isArray(raw) ? raw : [];
  }
  return history;
}

/**
 * Guarda una muestra {t, byKind:{kind:pct}} y poda lo viejo.
 * Se ignora si la anterior es demasiado reciente.
 */
function addSample(snapshot) {
  const h = getHistory();
  const last = h[h.length - 1];
  if (last && snapshot.fetchedAt - last.t < MIN_SAMPLE_GAP_MS) return h;

  const byKind = {};
  for (const l of snapshot.limits) byKind[l.kind] = l.pct;
  h.push({ t: snapshot.fetchedAt, byKind });

  const cutoff = Date.now() - HISTORY_DAYS * 24 * 3600 * 1000;
  let pruned = h.filter((s) => s.t >= cutoff);
  if (pruned.length > MAX_SAMPLES) pruned = pruned.slice(pruned.length - MAX_SAMPLES);
  history = pruned;
  writeJSON('history.json', history);
  return history;
}

/**
 * Umbrales ya avisados, con clave por ventana (kind + resets_at) para que
 * el aviso se rearme solo en cada ventana nueva.
 */
function getNotified() {
  if (!notified) notified = readJSON('notified.json', {});
  return notified;
}

function markNotified(key) {
  notified = { ...getNotified(), [key]: Date.now() };
  // Limpieza: descartar claves de hace más de 30 días.
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  for (const k of Object.keys(notified)) {
    if (notified[k] < cutoff) delete notified[k];
  }
  writeJSON('notified.json', notified);
}

module.exports = {
  getSettings,
  setSetting,
  getCache,
  setCache,
  getHistory,
  addSample,
  getNotified,
  markNotified,
};
