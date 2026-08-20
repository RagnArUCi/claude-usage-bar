# Registro de cambios

## v1.2.0 — 2026-08-17

- **Arreglo del texto ilegible del panel en macOS.** El panel se creaba con
  `transparent: true` y `vibrancy` a la vez, que entran en conflicto: la
  vibrancia no llegaba a pintar y el texto quedaba sobre el escritorio,
  invisible con fondos claros. La tarjeta pinta ahora siempre su propio fondo.
- **Soporte de Linux** (AppImage), instalación por un comando en los tres
  sistemas y aviso de versión nueva. Gracias a @mcampver (#1, #2).
- **Proyección corregida en ventanas largas.** Medía el ritmo siempre sobre la
  última hora, y extrapolar eso a la ventana semanal asume que nadie duerme:
  predecía el agotamiento para el día siguiente. Ahora el tramo depende de la
  duración de la ventana.
- Arreglado `scripts/check-usage.js`, roto al reescribir la lectura de la API.

## v1.1.1 — 2026-08-06

- **Arreglo del falso «la aplicación está dañada» en macOS.** El `.app`
  conservaba solo la firma que el enlazador pone en el binario de Electron, que
  deja de ser válida en cuanto electron-builder modifica el paquete. Una firma
  inválida provoca ese mensaje, que además es un callejón sin salida porque ni
  "Abrir igualmente" lo resuelve. Un hook `afterPack` firma ahora en modo
  ad-hoc y verifica el resultado.

## v1.1.0 — 2026-08-06

- **Panel al hacer clic**, con un medidor por límite leídos del array `limits[]`
  de la API, que es autodescriptivo: un límite nuevo aparece solo.
- **Proyección de consumo**: "a este ritmo se agota sobre las 18:40", por
  regresión sobre el historial.
- Medidores con el **color de acento del sistema**, con la luminosidad ajustada
  si no alcanza 3:1 de contraste, conservando el matiz.
- **Fin de los 429.** La causa no era la credencial sino el ritmo: se
  consultaba cada 60 s con el mismo token que usa Claude Code. Ahora el ritmo
  se adapta a la actividad local (~1.440 → ~290 peticiones diarias), hay una
  sola petición en vuelo, espera exponencial con `Retry-After`, y una caché
  persistente que evita que un fallo transitorio borre el último dato bueno.
- Avisos al 80 % y 95 %, elección de la métrica visible y arranque automático.

## v1.0.0 — 2026-07-06

Primera versión: logo de Claude con el porcentaje en la barra de menú de macOS
e icono con el número en la bandeja de Windows.
