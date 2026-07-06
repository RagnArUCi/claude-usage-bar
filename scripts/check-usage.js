// Prueba rápida sin Electron: consulta el uso y muestra SOLO los
// porcentajes (nunca el token). Útil para verificar que todo funciona.
'use strict';

const { fetchUsage } = require('../src/usage');

fetchUsage().then((u) => {
  if (u.error) {
    console.error(`Error: ${u.error}`);
    process.exit(1);
  }
  const show = (label, s) =>
    console.log(`${label}: ${s ? `${s.pct}% (se reinicia ${s.resetsAt})` : 'n/d'}`);
  show('Sesión (5h)', u.session);
  show('Semana', u.weekly);
  show('Semana Opus', u.opus);
});
