// Lee (y refresca cuando expira) las credenciales OAuth que Claude Code
// guarda localmente. El token nunca se registra en logs ni sale de la
// máquina: solo viaja a los endpoints oficiales de Anthropic.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const CREDS_FILE = path.join(os.homedir(), '.claude', '.credentials.json');
const KEYCHAIN_SERVICE = 'Claude Code-credentials';
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
// client_id público de Claude Code (está embebido en la propia CLI)
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

function execFileP(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

function readFromFile() {
  try {
    const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
    if (creds && creds.claudeAiOauth) {
      return { oauth: creds.claudeAiOauth, source: 'file', raw: creds };
    }
  } catch {}
  return null;
}

async function readFromKeychain() {
  if (process.platform !== 'darwin') return null;
  try {
    const out = await execFileP('security', [
      'find-generic-password', '-s', KEYCHAIN_SERVICE, '-w',
    ]);
    const creds = JSON.parse(out.trim());
    if (creds && creds.claudeAiOauth) {
      return { oauth: creds.claudeAiOauth, source: 'keychain', raw: creds };
    }
  } catch {}
  return null;
}

async function keychainAccount() {
  try {
    const out = await execFileP('security', [
      'find-generic-password', '-s', KEYCHAIN_SERVICE,
    ]);
    const m = out.match(/"acct"<blob>="([^"]*)"/);
    return m ? m[1] : os.userInfo().username;
  } catch {
    return os.userInfo().username;
  }
}

async function persist(entry) {
  const json = JSON.stringify({ ...entry.raw, claudeAiOauth: entry.oauth });
  if (entry.source === 'keychain') {
    const acct = await keychainAccount();
    await execFileP('security', [
      'add-generic-password', '-U',
      '-s', KEYCHAIN_SERVICE, '-a', acct, '-w', json,
    ]);
  } else {
    fs.writeFileSync(CREDS_FILE, json, { mode: 0o600 });
  }
}

/**
 * Refresca el token y lo guarda en la misma fuente de donde salió,
 * para no romper la sesión de Claude Code (rotación de refresh tokens).
 */
async function refresh(entry) {
  if (!entry.oauth.refreshToken) return null;
  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: entry.oauth.refreshToken,
        client_id: CLIENT_ID,
      }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let tok;
  try {
    tok = await res.json();
  } catch {
    return null;
  }
  if (!tok.access_token) return null;

  entry.oauth = {
    ...entry.oauth,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token || entry.oauth.refreshToken,
    expiresAt: Date.now() + (tok.expires_in || 3600) * 1000,
  };
  try {
    await persist(entry);
  } catch {
    // Si no se pudo guardar, el token sigue sirviendo para esta consulta.
  }
  return entry;
}

function isExpired(oauth) {
  return oauth.expiresAt && Date.now() > oauth.expiresAt - 60 * 1000;
}

/**
 * Devuelve una credencial lista para usar, refrescándola si hace falta.
 * Puede haber credenciales en el archivo y en el Llavero a la vez
 * (p. ej. un archivo viejo y el Llavero al día): se elige la más fresca.
 * @returns {Promise<{oauth: object, source: string}|null>}
 */
async function getOAuth() {
  const candidates = [readFromFile(), await readFromKeychain()]
    .filter((e) => e && e.oauth.accessToken)
    .sort((a, b) => (b.oauth.expiresAt || 0) - (a.oauth.expiresAt || 0));
  if (!candidates.length) return null;

  let entry = candidates[0];
  if (isExpired(entry.oauth)) {
    const refreshed = await refresh(entry);
    if (!refreshed) return { expired: true };
    entry = refreshed;
  }
  return entry;
}

module.exports = { getOAuth, refresh };
