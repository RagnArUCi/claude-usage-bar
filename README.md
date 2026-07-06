# Claude Usage Bar

Muestra en tiempo real el porcentaje de uso de tu plan de Claude:

- **macOS** — el logo de Claude con el porcentaje al lado, en la barra de menú superior (junto al reloj/Wi-Fi).
- **Windows** — un icono con el número dentro (estilo indicador de batería) en la bandeja del sistema, junto al reloj.

El porcentaje mostrado es el de la **sesión actual (ventana de 5 horas)**. Haciendo clic en el icono ves también el uso semanal, el semanal de Opus y cuándo se reinicia cada límite.

## Descarga

Ve a [Releases](../../releases) y descarga:

| Sistema | Archivo |
|---|---|
| macOS (Apple Silicon) | `Claude-Usage-x.x.x-arm64.dmg` |
| macOS (Intel) | `Claude-Usage-x.x.x.dmg` |
| Windows | `Claude-Usage-Setup-x.x.x.exe` |

### Nota al abrir por primera vez

Los instaladores no están firmados con certificado de pago, así que el sistema mostrará una advertencia:

- **macOS**: si dice que la app está dañada o no se puede verificar, ejecuta en Terminal:
  `xattr -cr "/Applications/Claude Usage.app"` y ábrela de nuevo (o clic derecho → Abrir).
- **Windows**: en el aviso de SmartScreen pulsa **Más información → Ejecutar de todas formas**.

## Requisitos

Tener **Claude Code** instalado y con sesión iniciada en la misma máquina. La app reutiliza (en modo solo lectura) la sesión que Claude Code ya guarda:

- macOS: Llavero (`Claude Code-credentials`) o `~/.claude/.credentials.json`
- Windows: `%USERPROFILE%\.claude\.credentials.json`

Con ese token consulta el endpoint oficial `https://api.anthropic.com/api/oauth/usage` cada 60 segundos.

## Privacidad

El token **nunca** sale de tu máquina ni se registra en logs: solo se envía a `api.anthropic.com`, que es su destino legítimo. La app no tiene analítica ni servidores propios.

## Estados del icono

| Icono | Significado |
|---|---|
| `42%` | Porcentaje usado de la sesión de 5 h |
| Rojo (Windows) / — | Uso ≥ 90 % |
| `–` / `!` | Sin credenciales o sesión expirada → abre Claude Code |

## Desarrollo

```bash
npm install
npm run gen-icon      # genera build/icon.png (el icono se dibuja por código)
npm run check-usage   # prueba la consulta a la API sin abrir la app
npm start             # ejecuta la app
npm run dist          # compila el instalador de tu plataforma
```

## Publicar una versión

```bash
npm version patch     # o minor/major
git push && git push --tags
```

GitHub Actions compila el `.dmg` (macOS) y el `.exe` (Windows) y los adjunta al Release automáticamente.

## Hoja de ruta

- [ ] Interfaz con panel al hacer clic (gráficas, historial, selección de métrica)
- [ ] Elegir qué métrica se muestra en la barra (sesión / semana / Opus)
- [ ] Notificaciones al llegar al 80 % / 95 %

## Licencia

MIT
