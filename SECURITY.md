# Seguridad

Esta app lee la sesión de Claude Code. Merece que digamos exactamente qué hace
con ella.

## Qué hace y qué no

**Qué hace.** Lee la sesión OAuth que Claude Code ya guardó en tu máquina y la
usa para consultar el endpoint oficial de consumo de Anthropic. Cuando el token
caduca, lo renueva contra el endpoint oficial y guarda el nuevo en la misma
fuente de donde salió, para no romper la sesión de Claude Code.

**Qué no hace.**

- No registra tokens en logs, mensajes de error ni salidas de depuración.
- No envía nada a ningún servidor propio: no hay servidor propio.
- No tiene analítica, telemetría ni informes de errores remotos.
- No pide credenciales al usuario. No hay ningún campo donde pegar un token.
- No escribe secretos en el repositorio. El único identificador en el código es
  el `client_id` público de Claude Code, embebido ya en la propia CLI.

## Dónde lee y a dónde sale

Lee de: el Llavero de macOS (servicio `Claude Code-credentials`) o
`~/.claude/.credentials.json`.

Sale a: `api.anthropic.com` para el consumo y `console.anthropic.com` para
renovar el token. La comprobación de actualizaciones consulta solo la API
pública de releases de GitHub y no envía ningún dato tuyo.

## Qué se guarda en tu equipo

En el directorio de datos de la app: `cache.json` (última lectura correcta),
`history.json` (porcentajes con su hora, hasta 8 días), `settings.json` y
`notified.json`. Ninguno contiene credenciales.

## Firma de los instaladores

Los binarios de macOS llevan **firma ad-hoc** pero **no están notarizados**:
notarizar exige una cuenta de desarrollador de Apple de pago. Consecuencias:

- macOS avisará la primera vez y hay que autorizar la app a mano.
- La firma ad-hoc garantiza que el paquete no se ha alterado **después** de
  compilarse, pero no acredita quién lo compiló.

Si esa garantía no te vale, compila desde el código: `npm install && npm run dist`.
El workflow de GitHub Actions es la única fuente de los binarios publicados y
su registro de ejecución es público.

## Reportar una vulnerabilidad

Si encuentras algo que exponga credenciales o permita filtrarlas, **no abras
una incidencia pública**. Usa el aviso privado de seguridad de GitHub en este
repositorio (pestaña *Security* → *Report a vulnerability*).

Incluye cómo reproducirlo y la versión. Por favor no adjuntes tus tokens
reales: describe el camino, no el secreto.
