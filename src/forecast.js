// Ritmo de consumo y proyección a partir del historial.
//
// Responde a la pregunta que de verdad importa mientras trabajas: "¿me
// alcanza hasta el reinicio o me voy a quedar sin sesión a media tarde?".
'use strict';

const MIN_SAMPLES = 3;
const MIN_SPAN_MS = 8 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000; // se mide el ritmo de la última hora
const MIN_RATE = 0.5; // %/h por debajo de esto se considera "sin consumo"

/**
 * Muestras de la ventana vigente: desde la última vez que el porcentaje
 * bajó (un reinicio). Así no hace falta saber cuánto dura cada ventana.
 */
function windowSamples(history, kind) {
  const pts = [];
  for (const s of history) {
    const pct = s.byKind && s.byKind[kind];
    if (typeof pct !== 'number') continue;
    pts.push({ t: s.t, pct });
  }
  let start = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].pct < pts[i - 1].pct - 1) start = i;
  }
  return pts.slice(start);
}

/** Pendiente por mínimos cuadrados, en puntos porcentuales por hora. */
function ratePerHour(points) {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  const pts = points.filter((p) => p.t >= cutoff);
  if (pts.length < MIN_SAMPLES) return null;
  const span = pts[pts.length - 1].t - pts[0].t;
  if (span < MIN_SPAN_MS) return null;

  const hours = pts.map((p) => (p.t - pts[0].t) / 3600000);
  const ys = pts.map((p) => p.pct);
  const mh = hours.reduce((a, b) => a + b, 0) / hours.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < pts.length; i++) {
    num += (hours[i] - mh) * (ys[i] - my);
    den += (hours[i] - mh) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

/**
 * @returns {{rate: number|null, etaAt: number|null, safeUntilReset: boolean}}
 *  rate: %/hora · etaAt: instante estimado de agotamiento · safeUntilReset:
 *  el límite se reinicia antes de agotarse al ritmo actual.
 */
function forecast(limit, history) {
  const pts = windowSamples(history, limit.kind);
  const rate = ratePerHour(pts);
  if (rate === null || rate < MIN_RATE || limit.pct >= 100) {
    return { rate, etaAt: null, safeUntilReset: rate !== null && rate < MIN_RATE };
  }
  const hoursLeft = (100 - limit.pct) / rate;
  const etaAt = Date.now() + hoursLeft * 3600000;
  const resetAt = limit.resetsAt ? Date.parse(limit.resetsAt) : NaN;
  const safeUntilReset = Number.isFinite(resetAt) && etaAt >= resetAt;
  return { rate, etaAt, safeUntilReset };
}

/** Serie reducida a `points` valores para la línea de tendencia. */
function sparkline(history, kind, points = 24) {
  const pts = windowSamples(history, kind);
  if (pts.length <= 1) return [];
  if (pts.length <= points) return pts;
  const out = [];
  for (let i = 0; i < points; i++) {
    const idx = Math.round((i * (pts.length - 1)) / (points - 1));
    out.push(pts[idx]);
  }
  return out;
}

module.exports = { forecast, sparkline, windowSamples, ratePerHour };
