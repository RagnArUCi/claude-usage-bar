# Cómo contribuir

Gracias por pasarte. Proyecto pequeño, reglas pocas.

## Empezar

```bash
git clone https://github.com/RagnArUCi/claude-usage-bar
cd claude-usage-bar
npm install
npm test              # unitarios, no tocan la red
npm run check-usage   # consulta la API de verdad, sin abrir la app
npm start             # ejecuta la app
```

`npm run check-usage` es la vía rápida: dice qué límites devuelve la API y con
qué porcentajes, sin arrancar Electron. Solo imprime porcentajes, nunca tokens.

Necesitas tener **Claude Code con sesión iniciada** en la máquina; la app
reutiliza esa sesión y no pide credenciales.

## Dos cosas que no cambian

**Los tokens no se registran nunca.** Ni en logs, ni en errores, ni depurando.
Si necesitas investigar autenticación, imprime longitudes o fechas de
caducidad.

**Nunca se muestra un número que no venga de la API.** Si la consulta falla, se
muestra el último dato bueno marcado como no reciente, o nada. Estimar el
consumo en una herramienta cuyo único trabajo es medirlo destruye la confianza
en el número.

## Antes de abrir el PR

```bash
npm test
npx electron-builder --dir   # solo si tocaste package.json o el workflow
```

Lo segundo importa: `npm test` no detecta una configuración de compilación
inválida, y ya hubo una release que falló en las tres plataformas por eso.

Si tocaste el panel, míralo en tema claro **y** oscuro. Varios fallos de esta
app han sido de legibilidad en una sola de las dos combinaciones.

## Estilo

- Español en comentarios, textos de interfaz y mensajes de commit.
- El comentario explica **por qué**, no qué hace la línea.
- **Sin dependencias de runtime.** La app no tiene ninguna: los iconos se
  generan con un codificador PNG propio en `src/png.js`. Una dependencia nueva
  necesita justificación.
- Nada de formateadores automáticos en el PR: los cambios de estilo masivos
  entierran el cambio real.

## Errores

Ayuda mucho incluir la salida de `npm run check-usage` —que no expone tokens—,
la versión de la app (sale en el menú del icono) y el sistema operativo. Si es
visual, una captura del panel.

## ¿Buscas la versión multi-proveedor?

Esta app cubre solo Claude, a propósito y por seguir siendo simple. Si te
interesa Gemini o Kiro además, existe
[ai-usage-bar](https://github.com/RagnArUCi/ai-usage-bar), que parte de este
mismo motor con una arquitectura de proveedores como módulos. Añadir un
proveedor tiene más sentido allí.

## Seguridad

Si encuentras algo que exponga tokens, mira `SECURITY.md` antes de abrir una
incidencia pública.

## Agentes de IA

`AGENTS.md` recoge la arquitectura, los invariantes y una lista de trampas ya
pisadas que conviene no reintroducir.
