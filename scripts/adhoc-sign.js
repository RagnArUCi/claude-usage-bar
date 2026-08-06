// Firma ad-hoc del paquete .app tras empaquetarlo (hook afterPack).
//
// Sin esto, el .app conserva solo la firma que el enlazador puso en el binario
// de Electron, que deja de ser válida en cuanto electron-builder modifica el
// paquete (mete el app.asar, reescribe el Info.plist, cambia el icono). Una
// firma inválida hace que macOS diga "la aplicación está dañada" — un callejón
// sin salida, porque ni "Abrir igualmente" lo salva.
//
// Con una firma ad-hoc válida el aviso pasa a ser el normal de desarrollador
// no identificado, que sí se puede saltar. No sustituye a la notarización
// (eso exige cuenta de pago de Apple), pero elimina el falso "dañado".
'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  execFileSync(
    'codesign',
    ['--force', '--deep', '--sign', '-', '--timestamp=none', appPath],
    { stdio: 'inherit' }
  );

  // Si la firma no queda válida, es mejor fallar la compilación que publicar
  // un instalador que el usuario no podrá abrir.
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], {
    stdio: 'inherit',
  });

  console.log(`  • firmado ad-hoc y verificado  ${appName}.app`);
};
