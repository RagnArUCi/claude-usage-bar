// Color de acento del sistema, con ajuste de contraste.
//
// El acento lo elige el usuario en Ajustes del sistema y puede ser cualquier
// tono, incluidos amarillos muy claros que sobre fondo claro serían
// ilegibles. Se mide el contraste real y, si no llega a 3:1 contra la
// superficie, se aclara u oscurece el tono hasta que lo cumpla.
'use strict';

const { systemPreferences } = require('electron');

const FALLBACK = '#d97757'; // coral de Claude, si el sistema no expone acento
const MIN_CONTRAST = 3.0;

const SURFACES = { light: '#fcfcfb', dark: '#1a1a19' };

// Paleta de estado (fija, nunca tematizada). Se acompaña siempre de icono y
// etiqueta, de modo que el color nunca es el único portador del significado.
const SEVERITY_COLORS = {
  normal: null, // usa el acento del sistema
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
};

function hexToRgb(hex) {
  const h = String(hex).replace('#', '').slice(0, 6);
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function relLuminance([r, g, b]) {
  const ch = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return 1;
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbToHsl([r, g, b]) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

/**
 * Devuelve el mismo tono con la luminosidad ajustada hasta alcanzar el
 * contraste mínimo contra la superficie. Conserva matiz y saturación.
 */
function snapToSurface(hex, surface, min = MIN_CONTRAST) {
  if (contrast(hex, surface) >= min) return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [h, s, l0] = rgbToHsl(rgb);
  const surfaceIsLight = relLuminance(hexToRgb(surface) || [255, 255, 255]) > 0.5;
  const step = surfaceIsLight ? -0.02 : 0.02;

  let best = hex;
  let l = l0;
  for (let i = 0; i < 50; i++) {
    l += step;
    if (l <= 0 || l >= 1) break;
    const candidate = rgbToHex(hslToRgb([h, s, l]));
    best = candidate;
    if (contrast(candidate, surface) >= min) return candidate;
  }
  return best;
}

/** Acento del sistema en '#rrggbb', o el coral de Claude como respaldo. */
function systemAccent() {
  try {
    const raw = systemPreferences.getAccentColor && systemPreferences.getAccentColor();
    if (raw && /^[0-9a-f]{6,8}$/i.test(raw)) return `#${raw.slice(0, 6).toLowerCase()}`;
  } catch {
    // Linux y algunos entornos no lo exponen.
  }
  return FALLBACK;
}

/**
 * Paquete de colores que consume la interfaz: el acento ya corregido para
 * cada modo, más la paleta de estado.
 */
function palette() {
  const accent = systemAccent();
  return {
    accentRaw: accent,
    accentLight: snapToSurface(accent, SURFACES.light),
    accentDark: snapToSurface(accent, SURFACES.dark),
    severity: SEVERITY_COLORS,
  };
}

module.exports = { palette, systemAccent, snapToSurface, contrast, SURFACES, SEVERITY_COLORS };
