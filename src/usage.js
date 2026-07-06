// Consulta el endpoint oficial de uso de la suscripción de Claude.
'use strict';

const { getOAuth, refresh } = require('./credentials');

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

function clampPct(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function pick(bucket) {
  if (!bucket || typeof bucket !== 'object') return null;
  const v = bucket.utilization;
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  return { pct: clampPct(v), resetsAt: bucket.resets_at || null };
}

async function callUsage(accessToken) {
  return fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'Content-Type': 'application/json',
    },
  });
}

/**
 * @returns {Promise<{session, weekly, opus}|{error: string}>}
 *  session/weekly/opus: {pct: number, resetsAt: string|null} | null
 */
async function fetchUsage() {
  let entry;
  try {
    entry = await getOAuth();
  } catch {
    entry = null;
  }
  if (!entry) return { error: 'no-credentials' };
  if (entry.expired) return { error: 'expired' };

  let res;
  try {
    res = await callUsage(entry.oauth.accessToken);
    // El token podía estar revocado aunque no estuviera vencido:
    // se intenta un único refresh y se reintenta.
    if (res.status === 401) {
      const refreshed = await refresh(entry);
      if (!refreshed) return { error: 'expired' };
      res = await callUsage(refreshed.oauth.accessToken);
    }
  } catch {
    return { error: 'network' };
  }
  if (res.status === 401 || res.status === 403) return { error: 'expired' };
  if (!res.ok) return { error: `http-${res.status}` };

  let data;
  try {
    data = await res.json();
  } catch {
    return { error: 'parse' };
  }

  const session = pick(data.five_hour);
  const weekly = pick(data.seven_day);
  const opus = pick(data.seven_day_opus);
  if (!session && !weekly) return { error: 'formato' };
  return { session, weekly, opus };
}

module.exports = { fetchUsage, USAGE_URL };
