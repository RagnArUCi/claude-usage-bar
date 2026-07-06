// Genera build/icon.png (512x512): fondo coral redondeado + sunburst blanco.
// electron-builder lo convierte automáticamente a .icns (mac) y .ico (win).
'use strict';

const fs = require('fs');
const path = require('path');
const { encodePNG } = require('../src/png');
const { drawSunburst, fillRoundedRect } = require('../src/logo');

const SIZE = 512;
const rgba = Buffer.alloc(SIZE * SIZE * 4);

fillRoundedRect(rgba, SIZE, SIZE, 100, [217, 119, 87]); // #D97757
drawSunburst(rgba, SIZE, SIZE, {
  cx: SIZE / 2,
  cy: SIZE / 2,
  radius: SIZE * 0.34,
  color: [250, 249, 245], // blanco hueso de la marca
});

const out = path.join(__dirname, '..', 'build', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, encodePNG(SIZE, SIZE, rgba));
console.log(`OK: ${out}`);
