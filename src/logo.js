// Dibuja el "sunburst" de Claude (rayos radiales) sobre un buffer RGBA.
// Todo se genera por código para no incluir binarios en el repo.
'use strict';

const RAYS = 12;

/**
 * Dibuja el logo dentro de un lienzo RGBA.
 * @param {Buffer} rgba lienzo width*height*4
 * @param {number} width
 * @param {number} height
 * @param {object} opts { cx, cy, radius, color: [r,g,b] }
 */
function drawSunburst(rgba, width, height, opts) {
  const { cx, cy, radius, color } = opts;
  const [cr, cg, cb] = color;
  const inner = radius * 0.02; // los rayos convergen en un núcleo sólido
  const half = radius * 0.085; // semiancho de cada rayo
  const SS = 3; // supermuestreo 3x3

  // Longitudes alternadas para imitar la irregularidad del logo real
  const lens = [];
  for (let i = 0; i < RAYS; i++) {
    lens.push(i % 3 === 0 ? 1.0 : i % 3 === 1 ? 0.82 : 0.93);
  }

  const rays = [];
  for (let i = 0; i < RAYS; i++) {
    const a = (i / RAYS) * Math.PI * 2 + Math.PI / RAYS;
    rays.push({
      x0: cx + Math.cos(a) * inner,
      y0: cy + Math.sin(a) * inner,
      x1: cx + Math.cos(a) * radius * lens[i],
      y1: cy + Math.sin(a) * radius * lens[i],
    });
  }

  const distToSeg = (px, py, s) => {
    const dx = s.x1 - s.x0;
    const dy = s.y1 - s.y0;
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((px - s.x0) * dx + (py - s.y0) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const qx = s.x0 + t * dx;
    const qy = s.y0 + t * dy;
    return Math.hypot(px - qx, py - qy);
  };

  const x0 = Math.max(0, Math.floor(cx - radius - 2));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius + 2));
  const y0 = Math.max(0, Math.floor(cy - radius - 2));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius + 2));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          for (const r of rays) {
            if (distToSeg(px, py, r) <= half) {
              hit++;
              break;
            }
          }
        }
      }
      if (!hit) continue;
      const cov = hit / (SS * SS);
      const idx = (y * width + x) * 4;
      // Mezcla alfa sobre lo que ya haya (fondo opaco o transparente)
      rgba[idx] = Math.round(cr * cov + rgba[idx] * (1 - cov));
      rgba[idx + 1] = Math.round(cg * cov + rgba[idx + 1] * (1 - cov));
      rgba[idx + 2] = Math.round(cb * cov + rgba[idx + 2] * (1 - cov));
      rgba[idx + 3] = Math.max(rgba[idx + 3], Math.round(cov * 255));
    }
  }
}

/** Rellena un rectángulo redondeado opaco. */
function fillRoundedRect(rgba, width, height, radius, color) {
  const [cr, cg, cb] = color;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = Math.max(radius - x, x - (width - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (height - 1 - radius), 0);
      const d = Math.hypot(dx, dy);
      let a = 255;
      if (d > radius) a = 0;
      else if (d > radius - 1.5) a = Math.round(((radius - d) / 1.5) * 255);
      const idx = (y * width + x) * 4;
      rgba[idx] = cr;
      rgba[idx + 1] = cg;
      rgba[idx + 2] = cb;
      rgba[idx + 3] = a;
    }
  }
}

module.exports = { drawSunburst, fillRoundedRect };
