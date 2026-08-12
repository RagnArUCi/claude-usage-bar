// Comprueba en GitHub si hay una versión más nueva publicada.
// Solo consulta la API pública de releases; no descarga ni instala nada:
// si hay novedad, la app avisa y abre la página de descarga.
'use strict';

const REPO = 'RagnArUCi/claude-usage-bar';
const LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

// Normaliza "v1.2.3" o "1.2.3" a [1, 2, 3].
function parts(v) {
  return String(v)
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

// 1 si a>b, -1 si a<b, 0 si iguales (compara x.y.z).
function compareVersions(a, b) {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function isNewer(latest, current) {
  return compareVersions(latest, current) > 0;
}

/**
 * @returns {Promise<{latest, url, updateAvailable}|{error: string}>}
 */
async function checkForUpdate(currentVersion, fetchImpl = fetch) {
  let res;
  try {
    res = await fetchImpl(LATEST_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'claude-usage-bar',
      },
    });
  } catch {
    return { error: 'network' };
  }
  if (!res.ok) return { error: `http-${res.status}` };

  let data;
  try {
    data = await res.json();
  } catch {
    return { error: 'parse' };
  }

  const tag = data && data.tag_name;
  if (!tag) return { error: 'formato' };

  const latest = String(tag).replace(/^v/i, '');
  return {
    latest,
    url: data.html_url || RELEASES_PAGE,
    updateAvailable: isNewer(latest, currentVersion),
  };
}

module.exports = {
  checkForUpdate,
  compareVersions,
  isNewer,
  LATEST_URL,
  RELEASES_PAGE,
  REPO,
};
