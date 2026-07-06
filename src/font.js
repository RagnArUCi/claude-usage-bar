// Fuente bitmap 5x7 para dibujar el porcentaje dentro del icono de la
// bandeja de Windows (los iconos de tray no admiten texto al lado).
'use strict';

const GLYPHS = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
};

const GLYPH_W = 5;
const GLYPH_H = 7;

/**
 * Dibuja texto en el lienzo RGBA.
 * @returns {number} ancho total dibujado en píxeles
 */
function drawText(rgba, width, height, text, x, y, scale, color) {
  const [cr, cg, cb] = color;
  let cursor = x;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) {
      cursor += (GLYPH_W + 1) * scale;
      continue;
    }
    for (let gy = 0; gy < GLYPH_H; gy++) {
      for (let gx = 0; gx < GLYPH_W; gx++) {
        if (g[gy][gx] !== '1') continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = cursor + gx * scale + sx;
            const py = y + gy * scale + sy;
            if (px < 0 || py < 0 || px >= width || py >= height) continue;
            const idx = (py * width + px) * 4;
            rgba[idx] = cr;
            rgba[idx + 1] = cg;
            rgba[idx + 2] = cb;
            rgba[idx + 3] = 255;
          }
        }
      }
    }
    cursor += (GLYPH_W + 1) * scale;
  }
  return cursor - x - scale; // sin el último espaciado
}

function textWidth(text, scale) {
  return text.length * (GLYPH_W + 1) * scale - scale;
}

module.exports = { drawText, textWidth, GLYPH_W, GLYPH_H };
