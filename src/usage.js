// Consulta el endpoint oficial de uso de la suscripción de Claude.
'use strict';

const { getOAuth, refresh } = require('./credentials');

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

// Etiquetas legibles para cada tipo de límite que devuelve la API.
const LABELS = {
  session: 'Sesión',
  weekly_all: 'Semana',
  weekly_opus: 'Semana · Opus',
  weekly_sonnet: 'Semana · Sonnet',
  weekly_oauth_apps: 'Semana · Apps',
  weekly_cowork: 'Semana · Cowork',
};

const SUBLABELS = {
  session: 'ventana de 5 horas',
  weekly_all: 'todos los modelos',
};

function labelFor(kind) {
  if (LABELS[kind]) return LABELS[kind];
  return String(kind || 'Límite').replace(/_/g, ' ');
}

function clampPct(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * La API expone `limits[]`, autodescriptivo y con `severity` calculada por el
 * servidor. Se prefiere sobre los campos sueltos (five_hour, seven_day…), que
 * se usan solo como respaldo si algún día `limits` desaparece.
 */
function parseLimits(data) {
  const out = [];

  if (Array.isArray(data.limits)) {
    for (const l of data.limits) {
      if (!l || typeof l.percent !== 'number' || Number.isNaN(l.percent)) continue;
      out.push({
        kind: l.kind || 'unknown',
        group: l.group || l.kind || 'unknown',
        label: labelFor(l.kind),
        sublabel: SUBLABELS[l.kind] || null,
        pct: clampPct(l.percent),
        severity: l.severity || 'normal',
        resetsAt: l.resets_at || null,
      });
    }
  }

  if (!out.length) {
    const legacy = [
      ['session', data.five_hour],
      ['weekly_all', data.seven_day],
      ['weekly_opus', data.seven_day_opus],
    ];
    for (const [kind, b] of legacy) {
      if (!b || typeof b.utilization !== 'number') continue;
      out.push({
        kind,
        group: kind === 'session' ? 'session' : 'weekly',
        label: labelFor(kind),
        sublabel: SUBLABELS[kind] || null,
        pct: clampPct(b.utilization),
        severity: 'normal',
        resetsAt: b.resets_at || null,
      });
    }
  }

  return out;
}

function callUsage(accessToken) {
  return fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Convierte la cabecera Retry-After (segundos o fecha HTTP) en milisegundos.
 * @returns {number|null}
 */
function parseRetryAfter(res) {
  const raw = res.headers.get('retry-after');
  if (!raw) return null;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(raw);
  if (Number.isFinite(when)) return Math.max(0, when - Date.now());
  return null;
}

/**
 * Un fallo se describe con {error, retryAfterMs?, retryable}. El llamador
 * decide si reintenta; aquí no se hace ningún reintento en bucle.
 *
 * @returns {Promise<{limits: Array, spend: object|null, fetchedAt: number}
 *                  |{error: string, retryable: boolean, retryAfterMs?: number}>}
 */
async function fetchUsage() {
  let entry;
  try {
    entry = await getOAuth();
  } catch {
    entry = null;
  }
  if (!entry) return { error: 'no-credentials', retryable: false };
  if (entry.expired) return { error: 'expired', retryable: false };

  let res;
  try {
    res = await callUsage(entry.oauth.accessToken);
    // El token podía estar revocado aunque no estuviera vencido:
    // un único refresh y se reintenta una sola vez.
    if (res.status === 401) {
      const refreshed = await refresh(entry);
      if (!refreshed) return { error: 'expired', retryable: false };
      res = await callUsage(refreshed.oauth.accessToken);
    }
  } catch {
    return { error: 'network', retryable: true };
  }

  if (res.status === 429) {
    return {
      error: 'rate-limit',
      retryable: true,
      retryAfterMs: parseRetryAfter(res),
    };
  }
  if (res.status === 401 || res.status === 403) {
    return { error: 'expired', retryable: false };
  }
  if (res.status >= 500) {
    return { error: `http-${res.status}`, retryable: true, retryAfterMs: parseRetryAfter(res) };
  }
  if (!res.ok) return { error: `http-${res.status}`, retryable: false };

  let data;
  try {
    data = await res.json();
  } catch {
    return { error: 'parse', retryable: true };
  }

  const limits = parseLimits(data);
  if (!limits.length) return { error: 'formato', retryable: false };

  return {
    limits,
    spend: data.spend && data.spend.enabled ? data.spend : null,
    fetchedAt: Date.now(),
  };
}

module.exports = { fetchUsage, parseLimits, labelFor, USAGE_URL };
