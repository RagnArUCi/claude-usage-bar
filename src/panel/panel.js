'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';

// El color de estado siempre viaja con una etiqueta: nunca informa por sí solo.
const SEVERITY_LABEL = {
  normal: 'Normal',
  good: 'Normal',
  warning: 'Atención',
  serious: 'Poco margen',
  critical: 'Casi agotado',
};

const $ = (id) => document.getElementById(id);
let last = null;

/* ---------- Formato ---------- */

function fmtDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function resetInfo(iso) {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  const dt = at - Date.now();
  if (dt <= 0) return { short: 'reiniciando…', long: 'reiniciando…' };
  if (dt < 24 * 3600 * 1000) {
    return { short: `quedan ${fmtDuration(dt)}`, long: `se reinicia en ${fmtDuration(dt)}` };
  }
  const d = new Date(at);
  const txt = d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
  const hm = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return { short: `hasta el ${txt}`, long: `se reinicia el ${txt}, ${hm}` };
}

function fmtAge(ms) {
  if (ms == null) return '';
  const s = Math.round(ms / 1000);
  if (s < 45) return `actualizado hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `actualizado hace ${m} min`;
  return `actualizado hace ${Math.round(m / 60)} h`;
}

function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

/* ---------- Logo ---------- */

function buildLogo() {
  const svg = $('logo');
  const rays = 12;
  const cx = 8;
  const cy = 8;
  const R = 7.1;
  const lens = [1, 0.82, 0.93];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + Math.PI / rays;
    const len = R * lens[i % 3];
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', (cx + Math.cos(a) * 0.2).toFixed(2));
    line.setAttribute('y1', (cy + Math.sin(a) * 0.2).toFixed(2));
    line.setAttribute('x2', (cx + Math.cos(a) * len).toFixed(2));
    line.setAttribute('y2', (cy + Math.sin(a) * len).toFixed(2));
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '1.35');
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);
  }
}

/* ---------- Tendencia ---------- */

function drawSpark(points, accent) {
  const svg = $('spark');
  svg.replaceChildren();
  // `hidden` es una propiedad de HTMLElement; un <svg> es SVGElement, así que
  // aquí hay que tocar el atributo directamente.
  if (!points || points.length < 2) {
    svg.setAttribute('hidden', '');
    return;
  }
  svg.removeAttribute('hidden');
  const h = 32;
  const pad = 3;
  const w = svg.clientWidth || 272;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const span = Math.max(1, t1 - t0);
  // Dominio anclado en cero para no exagerar la pendiente.
  const top = Math.max(10, Math.max(...points.map((p) => p.pct)) * 1.25);
  const x = (t) => pad + ((t - t0) / span) * (w - pad * 2);
  const y = (p) => h - pad - (p / top) * (h - pad * 2);

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.pct).toFixed(1)}`).join(' ');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  // Línea en el tono de atenuación; el punto actual lleva el acento.
  path.setAttribute('stroke', 'var(--text-muted)');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('opacity', '0.55');
  svg.appendChild(path);

  const lastPt = points[points.length - 1];
  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', x(lastPt.t).toFixed(1));
  dot.setAttribute('cy', y(lastPt.pct).toFixed(1));
  dot.setAttribute('r', '4');
  dot.setAttribute('fill', accent);
  // Anillo del color de la superficie: mantiene el punto legible al cruzar la línea.
  dot.setAttribute('stroke', 'var(--surface)');
  dot.setAttribute('stroke-width', '2');
  svg.appendChild(dot);
}

/* ---------- Medidores ---------- */

function meterEl(limit, accent, severityColors) {
  const wrap = document.createElement('div');
  wrap.className = 'meter';

  const color = severityColors[limit.severity] || accent;
  wrap.style.setProperty('--fill', color);

  const head = document.createElement('div');
  head.className = 'meter-head';
  const label = document.createElement('span');
  label.className = 'm-label';
  label.textContent = limit.sublabel ? `${limit.label} · ${limit.sublabel}` : limit.label;
  const val = document.createElement('span');
  val.className = 'm-val';
  val.textContent = `${limit.pct} %`;
  head.append(label, val);

  const track = document.createElement('div');
  track.className = 'track';
  const fill = document.createElement('div');
  fill.className = 'fill';
  fill.style.width = `${limit.pct}%`;
  track.appendChild(fill);

  wrap.append(head, track);

  const reset = resetInfo(limit.resetsAt);
  if (reset) {
    const sub = document.createElement('div');
    sub.className = 'm-sub';
    sub.textContent = reset.long;
    wrap.appendChild(sub);
  }
  return wrap;
}

/* ---------- Render ---------- */

function render(payload) {
  last = payload;
  const { state, palette, settings, loginItem, primaryKind } = payload;
  const accent = palette.accent;
  document.documentElement.style.setProperty('--accent', accent);

  const limits = state.limits || [];
  const primary = limits.find((l) => l.kind === primaryKind) || limits[0] || null;

  // Cifra principal
  if (primary) {
    $('heroPct').textContent = primary.pct;
    const reset = resetInfo(primary.resetsAt);
    $('heroCap').textContent = reset ? `${primary.label} · ${reset.short}` : primary.label;

    // El chip solo aparece cuando hay algo que atender: en estado normal la
    // barra ya lo dice y una etiqueta "Normal" no aporta nada accionable.
    const sev = primary.severity || 'normal';
    if (sev === 'normal' || sev === 'good') {
      $('chip').hidden = true;
    } else {
      $('chipDot').style.background = palette.severity[sev] || accent;
      $('chipText').textContent = SEVERITY_LABEL[sev] || sev;
      $('chip').hidden = false;
    }
  } else {
    $('heroPct').textContent = '–';
    $('heroCap').textContent = 'Sin datos todavía';
    $('chip').hidden = true;
  }

  // Proyección al ritmo actual
  const fc = primary && primary.fc;
  const fcEl = $('forecast');
  if (fc && fc.etaAt && !fc.safeUntilReset) {
    fcEl.textContent = `A este ritmo se agota sobre las ${fmtClock(fc.etaAt)}`;
    fcEl.hidden = false;
  } else if (fc && fc.rate !== null && fc.safeUntilReset) {
    fcEl.textContent = 'A este ritmo te alcanza hasta el reinicio';
    fcEl.hidden = false;
  } else {
    fcEl.hidden = true;
  }

  drawSpark(primary ? state.spark : null, accent);

  // Medidores
  const meters = $('meters');
  meters.replaceChildren();
  for (const l of limits) meters.appendChild(meterEl(l, accent, palette.severity));

  // Aviso: solo cuando hay algo que el usuario deba hacer o saber.
  const notice = $('notice');
  if (state.needsLogin) {
    notice.textContent =
      state.error === 'no-credentials'
        ? 'No encuentro una sesión de Claude Code. Ábrelo e inicia sesión.'
        : 'La sesión de Claude Code caducó. Ábrelo para renovarla.';
    notice.hidden = false;
  } else if (state.status === 'error') {
    notice.textContent = 'Todavía no hay datos. Reintentando…';
    notice.hidden = false;
  } else if (state.status === 'stale') {
    notice.textContent = 'Sin respuesta de la API ahora mismo; se muestra el último dato.';
    notice.hidden = false;
  } else {
    notice.hidden = true;
  }

  $('age').textContent = state.fetchedAt ? fmtAge(state.ageMs) : '';

  // Ajustes
  const metric = $('metric');
  const options = [{ kind: 'auto', label: 'Automático' }, ...limits.map((l) => ({ kind: l.kind, label: l.label }))];
  const signature = options.map((o) => o.kind).join(',');
  if (metric.dataset.kinds !== signature) {
    metric.dataset.kinds = signature;
    metric.replaceChildren();
    for (const o of options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.role = 'radio';
      b.textContent = o.label;
      b.dataset.kind = o.kind;
      b.addEventListener('click', () => window.api.setSetting('barMetric', o.kind));
      metric.appendChild(b);
    }
  }
  for (const b of metric.children) {
    b.setAttribute('aria-checked', String(b.dataset.kind === settings.barMetric));
  }
  $('notify').checked = !!settings.notifyThresholds;
  $('login').checked = !!loginItem;
  $('login').disabled = payload.canAutoLaunch === false;
  $('loginLabel').textContent =
    payload.canAutoLaunch === false
      ? 'Iniciar al encender (solo app instalada)'
      : 'Iniciar al encender el equipo';

  reportHeight();
}

let rafPending = false;
function reportHeight() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    window.api.resize(Math.ceil($('card').getBoundingClientRect().height));
  });
}

/* ---------- Arranque ---------- */

buildLogo();

$('gear').addEventListener('click', () => {
  const showing = !$('settings').hidden;
  $('settings').hidden = showing;
  $('main').hidden = !showing;
  $('gear').setAttribute('aria-pressed', String(!showing));
  reportHeight();
});

$('refresh').addEventListener('click', () => window.api.refresh());
$('notify').addEventListener('change', (e) =>
  window.api.setSetting('notifyThresholds', e.target.checked)
);
$('login').addEventListener('change', (e) => window.api.setLoginItem(e.target.checked));

window.api.onPayload(render);
window.api.request();

// Mantiene frescos los textos relativos ("quedan 2 h 14 min", "hace 30 s").
setInterval(() => {
  if (last) render(last);
}, 20000);

new ResizeObserver(reportHeight).observe($('card'));
