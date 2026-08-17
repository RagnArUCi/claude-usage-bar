# Claude Usage Bar

Muestra en tiempo real el porcentaje de uso de tu plan de Claude:

- **macOS** — el logo de Claude con el porcentaje al lado, en la barra de menú superior.
- **Windows / Linux** — un icono con el número dentro (estilo indicador de batería) en la bandeja del sistema.

Al hacer clic se abre un panel con un medidor por cada límite, la tendencia de la sesión y una proyección de cuándo se te agota al ritmo actual.
<img width="2000" height="1050" alt="image-1786681851749" src="https://github.com/user-attachments/assets/f743c7cf-1b5c-4958-8990-d8c03be27981" />

La app instalada se configura sola para **iniciarse al encender el equipo** (Windows, macOS y Linux) la primera vez que la abres. Se puede desactivar cuando quieras desde el menú del icono → "Iniciar al encender el equipo".

También **avisa cuando hay una versión nueva**: comprueba GitHub al arrancar y cada 6 h, muestra una notificación y añade un acceso en el menú para abrir la descarga. Nunca instala nada por su cuenta.

## Instalación

### Con un comando (recomendado)

Descarga e instala el último release automáticamente, sin entrar a la web:

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/RagnArUCi/claude-usage-bar/main/scripts/install.sh | sh
```

**Windows** (PowerShell)
```powershell
irm https://raw.githubusercontent.com/RagnArUCi/claude-usage-bar/main/scripts/install.ps1 | iex
```

El script detecta tu sistema, baja el instalador correcto del último Release, lo instala y abre la app.

### Descarga manual

Ve a [Releases](../../releases) y descarga:

| Sistema | Archivo |
|---|---|
| macOS (Apple Silicon) | `Claude-Usage-x.x.x-arm64.dmg` |
| macOS (Intel) | `Claude-Usage-x.x.x.dmg` |
| Windows | `Claude-Usage-Setup-x.x.x.exe` |
| Linux | `Claude-Usage-x.x.x.AppImage` |

En Linux, tras descargar dale permiso de ejecución y ábrelo:
```bash
chmod +x Claude-Usage-*.AppImage && ./Claude-Usage-*.AppImage
```

### Nota al abrir por primera vez

Los instaladores llevan firma ad-hoc pero no están notarizados (eso exige una cuenta de desarrollador de Apple de pago), así que el sistema mostrará una advertencia la primera vez.

**macOS** — arrastra la app a Aplicaciones y ejecuta en Terminal:

```bash
xattr -cr "/Applications/Claude Usage.app"
```

Eso quita la marca de cuarentena que pone el navegador al descargar (el instalador por comando ya lo hace por ti). Como alternativa sin Terminal: ábrela, y cuando salte el aviso ve a **Ajustes del Sistema → Privacidad y seguridad** y pulsa **Abrir igualmente**. En macOS Sequoia (15) y posteriores el antiguo truco de clic derecho → Abrir ya no funciona.

**Windows** — en el aviso de SmartScreen pulsa **Más información → Ejecutar de todas formas**.

**Linux** — si el icono no aparece en la bandeja, mira la nota de entornos de escritorio más abajo.

## Qué muestra el panel

- **Cifra principal** — el límite más restrictivo (o el que elijas en ajustes).
- **Proyección** — "a este ritmo se agota sobre las 18:40", por regresión sobre tu historial. Si el reinicio llega antes, lo dice. El tramo que se mide depende de la ventana: 1 hora para la sesión de 5 h, 48 horas para la semanal — extrapolar un ritmo horario a 7 días asumiría que trabajas sin dormir.
- **Tendencia** — la curva de consumo de la ventana actual.
- **Un medidor por límite** — sesión de 5 h, semana, y los que la API vaya añadiendo (Opus, Sonnet…). La app lee el array `limits[]` de la API, así que un límite nuevo aparece solo, sin actualizar la app.
- **Avisos** al cruzar el 80 % y el 95 %, una sola vez por ventana.

### Colores

El relleno de los medidores usa el **color de acento del sistema** y la pista un paso más claro del mismo tono. Como el acento lo eliges tú y puede ser cualquier color (un amarillo claro sobre fondo claro sería ilegible), la app mide el contraste real y ajusta la luminosidad hasta alcanzar 3:1, conservando el matiz.

Cuando la API marca severidad, el medidor pasa a los colores de estado (ámbar / coral / rojo) y aparece una etiqueta de texto: el color nunca es el único portador del significado.

## Requisitos

Tener **Claude Code** instalado y con sesión iniciada en la misma máquina. La app reutiliza la sesión que Claude Code ya guarda:

- macOS: Llavero (`Claude Code-credentials`) o `~/.claude/.credentials.json`
- Windows: `%USERPROFILE%\.claude\.credentials.json`
- Linux: `~/.claude/.credentials.json`

Con ese token consulta el endpoint oficial `https://api.anthropic.com/api/oauth/usage` y renueva el token solo cuando caduca.

## Cómo evita el error 429

El problema no es el tipo de credencial, sino el ritmo de consultas: el mismo token lo usa también Claude Code, las peticiones se suman y el endpoint acaba limitando. La app aplica cuatro medidas:

1. **Ritmo adaptativo.** El porcentaje solo se mueve cuando de verdad usas Claude, así que la app vigila la actividad local de Claude Code (`~/.claude/projects`) y solo entonces consulta cada 90 s. En reposo, cada 5 minutos; con el panel abierto, cada 60 s. Pasa de ~1.440 peticiones al día a ~290.
2. **Una sola petición en vuelo.** Nunca se solapan.
3. **Espera exponencial con jitter**, respetando la cabecera `Retry-After` cuando llega.
4. **Caché persistente.** Un fallo transitorio nunca borra el último dato bueno: el panel lo sigue mostrando y marca "no reciente" en lugar de dar error.

Además se refresca al despertar el equipo, al desbloquear la pantalla y justo después de que se reinicie una ventana.

### Linux: icono en la bandeja

El soporte de bandeja depende del entorno de escritorio:

- **KDE, XFCE, Cinnamon, MATE, Budgie**: funciona sin nada extra.
- **GNOME**: necesita la extensión [AppIndicator and KStatusNotifierItem Support](https://extensions.gnome.org/extension/615/appindicator-support/) para mostrar iconos de bandeja.

En Linux el porcentaje va dentro del icono (como en Windows); GNOME no permite texto suelto en la barra.

## Privacidad

El token **nunca** sale de tu máquina ni se registra en logs: solo se envía a `api.anthropic.com`, que es su destino legítimo. La comprobación de actualizaciones solo consulta la API pública de releases de GitHub (no envía ningún dato tuyo). La app no tiene analítica ni servidores propios. El historial de uso se guarda solo en tu equipo (`history.json` en el directorio de datos de la app).

## Desarrollo

```bash
npm install
npm run gen-icon      # genera build/icon.png (el icono se dibuja por código)
npm run check-usage   # prueba la consulta a la API sin abrir la app
npm test              # tests unitarios (autostart, comparación de versiones…)
npm start             # ejecuta la app
npm run dist          # compila el instalador de tu plataforma
```

## Publicar una versión

```bash
npm version minor && git push && git push --tags
```

GitHub Actions compila el `.dmg` (macOS), el `.exe` (Windows) y el `.AppImage` (Linux) y los adjunta al Release (queda en borrador; se publica con `gh release edit vX.Y.Z --draft=false`).

## Hoja de ruta

- [ ] Ventana de historial con varios días
- [ ] Atajo de teclado global para abrir el panel
- [ ] Soporte para créditos extra (`extra_usage`) cuando estén activos

## Licencia

MIT
