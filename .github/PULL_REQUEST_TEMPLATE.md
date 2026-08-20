## Qué cambia

<!-- Y por qué. Si arregla una incidencia: Cierra #N -->

## Comprobado

- [ ] `npm test`
- [ ] `npx electron-builder --dir` — **obligatorio si tocaste `package.json` o el workflow**;
      los tests no detectan una configuración de compilación inválida
- [ ] Probado en la app real, no solo en tests

## Si toca el panel

- [ ] Revisado en tema claro y oscuro
- [ ] Ningún texto queda ilegible sobre su fondo

## Siempre

- [ ] Ningún token aparece en logs ni en mensajes de error
- [ ] No se muestra ningún número que no venga de la API
