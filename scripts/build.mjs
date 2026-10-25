// Genera la calculadora (calculadora-idom.html) y «Mi plan» (plan.html), cada una en un solo archivo, a partir de src/.
// Uso: node scripts/build.mjs
import {readFileSync, writeFileSync, copyFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = f => join(raiz, 'src', f);
const leer = f => readFileSync(src(f), 'utf8');

const version = new Date().toISOString().slice(0, 16).replace('T', ' ');

/* Mete estilos y scripts en el propio HTML para que cada página sea un solo archivo */
function empaquetar(origen, destino) {
  let html = leer(origen);
  // estilos en línea
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, f) => `<style>\n${leer(f)}</style>`);
  // scripts en línea (el contenido no puede cerrar la etiqueta por accidente)
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => {
    const js = leer(f).replace(/<\/script/gi, '<\\/script');
    return `<script>\n${js}\n</script>`;
  });
  html = html.replace('__VERSION__', version);
  writeFileSync(join(raiz, destino), html);
  return html;
}

const html = empaquetar('index.html', 'calculadora-idom.html');
const plan = empaquetar('plan.html', 'plan.html');

// archivos de la app instalable
for (const f of ['manifest.webmanifest', 'icono.svg', 'icono-192.png', 'icono-512.png', 'icono-180.png']) {
  if (existsSync(src(f))) copyFileSync(src(f), join(raiz, f));
}
if (existsSync(src('sw.js'))) {
  writeFileSync(join(raiz, 'sw.js'), leer('sw.js').replace('__VERSION__', version));
}
console.log('calculadora-idom.html', (html.length / 1024).toFixed(0), 'KB · plan.html', (plan.length / 1024).toFixed(0), 'KB · versión', version);
