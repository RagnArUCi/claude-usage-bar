// Genera en tiempo de ejecución los iconos de la bandeja del sistema.
'use strict';

const { nativeImage } = require('electron');
const { encodePNG } = require('./png');
const { drawSunburst, fillRoundedRect } = require('./logo');
const { drawText, textWidth } = require('./font');

const CORAL = [217, 119, 87]; // #D97757, color de marca de Claude
const RED = [179, 38, 30];
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

/**
 * macOS: logo de Claude como "template image" (la barra de menú lo tiñe
 * automáticamente en claro/oscuro). El porcentaje va como texto con setTitle.
 */
function macTemplateIcon() {
  const make = (size) => {
    const rgba = Buffer.alloc(size * size * 4);
    drawSunburst(rgba, size, size, {
      cx: size / 2,
      cy: size / 2,
      radius: size * 0.46,
      color: BLACK,
    });
    return encodePNG(size, size, rgba);
  };
  const img = nativeImage.createFromBuffer(make(18), { scaleFactor: 1 });
  img.addRepresentation({ scaleFactor: 2, buffer: make(36) });
  img.setTemplateImage(true);
  return img;
}

/**
 * Windows: los iconos del tray no permiten texto al lado, así que el
 * porcentaje se dibuja dentro del icono (estilo indicador de batería):
 * fondo coral redondeado con el número en blanco.
 */
function winPercentIcon(text, pct) {
  const size = 32;
  const rgba = Buffer.alloc(size * size * 4);
  const bg = typeof pct === 'number' && pct >= 90 ? RED : CORAL;
  fillRoundedRect(rgba, size, size, 7, bg);

  const scale = text.length <= 2 ? 3 : 2;
  const w = textWidth(text, scale);
  const x = Math.round((size - w) / 2);
  const y = Math.round((size - 7 * scale) / 2);
  drawText(rgba, size, size, text, x, y, scale, WHITE);

  return nativeImage.createFromBuffer(encodePNG(size, size, rgba));
}

module.exports = { macTemplateIcon, winPercentIcon, CORAL };
