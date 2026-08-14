// Prueba rápida sin Electron: consulta el uso y muestra SOLO los
// porcentajes (nunca el token). Útil para verificar que todo funciona.
'use strict';

const { fetchUsage } = require('../src/usage');

fetchUsage().then((u) => {
  if (u.error) {
    console.error(`Error: ${u.error}${u.retryable ? ' (reintentable)' : ''}`);
    process.exit(1);
  }
  for (const l of u.limits) {
    const reset = l.resetsAt ? ` · se reinicia ${new Date(l.resetsAt).toLocaleString()}` : '';
    console.log(`${l.label}: ${l.pct} % [${l.severity}]${reset}`);
  }
});
