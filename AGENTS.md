# AGENTS.md

Instrucciones para agentes de IA que trabajen en este repositorio. Si eres una
persona, `CONTRIBUTING.md` cuenta lo mismo con menos aristas.

## Qué es esto

App de bandeja del sistema (Electron) que muestra el porcentaje de uso del plan
de Claude. Sin ventanas de escritorio: un icono con un porcentaje y un panel
que se abre al hacer clic.

```
npm install
npm test              # unitarios, sin red
npm run check-usage   # consulta la API de verdad, sin abrir la app
npm start             # ejecuta la app
npm run gen-icon      # regenera build/icon.png (se dibuja por código)
npm run dist          # compila el instalador de esta plataforma
```

## Reglas que no se negocian

**1. Los tokens no se registran nunca.** Ni en logs, ni en mensajes de error,
ni en salidas de depuración. Solo viajan a `api.anthropic.com`. Para depurar
autenticación, imprime longitudes o fechas de caducidad, nunca el valor.

**2. Nunca se muestra un número que no venga de la API.** Si la consulta falla
se muestra el último dato bueno marcado como no reciente, o nada. Estimar el
consumo en una herramienta cuyo trabajo es medirlo destruye la confianza en el
número.

**3. Cuidado con el ritmo de las consultas.** El endpoint limita y el mismo
token lo usa Claude Code. La capa de resiliencia existe por eso: si añades una
llamada, hazla pasar por el poller. No metas `setInterval` con red por tu
cuenta.

**4. Cambios de configuración de compilación se validan compilando.**
`npm test` no detecta un `package.json` inválido. Ejecuta
`npx electron-builder --dir` antes de etiquetar. Hubo una release que falló en
las tres plataformas por una clave de comentario en `package.json`:
electron-builder valida estricto y rechaza propiedades desconocidas.

## Arquitectura

```
main.js                bandeja, panel, IPC, avisos, arranque
src/poller.js          ritmo adaptativo, backoff, caché — la resiliencia
src/store.js           ajustes, caché e historial
src/usage.js           consulta y normalización de la respuesta de la API
src/credentials.js     lectura y renovación de la sesión de Claude Code
src/forecast.js        ritmo de consumo y proyección por mínimos cuadrados
src/color.js           acento del sistema con ajuste de contraste
src/trayIcon.js        iconos de bandeja generados en ejecución
src/png.js src/logo.js src/font.js   dibujo y codificación PNG, sin dependencias
src/autoLaunch.js      arranque al iniciar sesión
src/updateCheck.js     aviso de versión nueva
src/panel/             interfaz del panel (renderer aislado, sandbox)
```

### La API

`GET https://api.anthropic.com/api/oauth/usage` con `Bearer` y la cabecera
`anthropic-beta: oauth-2025-04-20`.

Lo que importa es el array **`limits`**, autodescriptivo: cada entrada trae
`kind`, `group`, `percent`, `severity` y `resets_at`. **La severidad la calcula
el servidor**, no la inventes con umbrales locales. Y como es autodescriptivo,
un límite nuevo aparece solo sin tocar la app: no vuelvas a leer los campos
sueltos (`five_hour`, `seven_day`…), que solo están como respaldo.

Las respuestas 200 no traen cabeceras de límite, así que no se puede anticipar
cuánto margen queda: solo reaccionar al `Retry-After` del 429.

### Credenciales

Llavero de macOS (`Claude Code-credentials`) o `~/.claude/.credentials.json`.
Pueden existir las dos fuentes a la vez, así que se elige la de `expiresAt` más
lejano. **Los refresh tokens rotan**: el nuevo hay que guardarlo en la misma
fuente de donde salió, o la siguiente renovación falla con `invalid_grant`.

### La proyección

El tramo sobre el que se mide el ritmo **depende de la duración de la ventana**:
una hora para la sesión de 5 h, 48 horas para la semanal. Extrapolar un ritmo
horario a siete días asume que nadie duerme y predice el agotamiento para el
día siguiente. No unifiques los perfiles.

## Trampas ya pisadas

Están resueltas en el código; se listan para no reintroducirlas.

**CSS: `[hidden]` pierde contra un `display` explícito.** La hoja del navegador
trae `[hidden] { display: none }`, pero cualquier `display` de la hoja de autor
gana. Por eso `panel.css` refuerza `[hidden] { display: none !important }`.

**`hidden` no existe en SVG.** Es propiedad de `HTMLElement`; un `<svg>` es
`SVGElement`. `svg.hidden = false` no quita el atributo: usa
`removeAttribute('hidden')`.

**Nada de `<select>` nativo en el panel.** El panel se cierra al perder el
foco y un desplegable nativo se lo quita. Usa el control segmentado.

**La tarjeta pinta su propio fondo opaco.** `transparent: true` y `vibrancy`
entran en conflicto en macOS: la vibrancia no llega a pintar y el texto queda
sobre el escritorio, ilegible con fondos claros.

**El acento del sistema puede ser ilegible.** Un amarillo claro sobre fondo
claro da contraste 1,05. `src/color.js` lo mide y ajusta la luminosidad hasta
3:1 conservando el matiz.

**La firma ad-hoc no es opcional en macOS.** Sin el hook `afterPack`, el `.app`
conserva solo la firma que el enlazador puso en el binario de Electron, que
deja de ser válida en cuanto electron-builder modifica el paquete. Una firma
inválida hace que macOS diga "la aplicación está dañada" — un callejón sin
salida, porque ni "Abrir igualmente" lo salva. `identity: "-"` **no** sirve:
electron-builder lo busca como nombre de certificado en el Llavero y omite la
firma.

**El selector del instalador necesita exclusiones.** Para Mac Intel, un patrón
por sufijo como `[0-9]\.dmg$` también casa con `…-arm64.dmg`, que acaba en
`4.dmg`. El caso Intel descarta arm64 explícitamente.

## Al preparar una release

El workflow compila en las tres plataformas y **un solo job** crea el Release.
No lo cambies para que publique cada plataforma por su cuenta: los tres jobs
intentarían crear el mismo Release a la vez y el último en escribir se lleva
por delante las subidas de los otros.

El Release queda en **borrador** a propósito; las notas se escriben a mano
antes de publicarlo con `gh release edit <tag> --draft=false`.

Los eventos de push de etiquetas en GitHub Actions **tardan**. Si tras empujar
la etiqueta no ves la ejecución, espera unos minutos: re-empujar la etiqueta
acumula ejecuciones duplicadas.

## Estilo

Español en comentarios, textos de interfaz y mensajes de commit. El comentario
explica **por qué**, no qué hace la línea. **Sin dependencias de runtime**: la
app no tiene ninguna y conviene que siga así (los iconos se dibujan con un
codificador PNG propio en `src/png.js`).
