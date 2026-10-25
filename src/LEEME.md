# Código de la calculadora

- `index.html` · estructura de la página
- `estilos.css` · estilos (incluye la versión móvil y la de impresión)
- `datos.js` · tablas fiscales, países y parámetros por año
- `motor.js` · cálculo: sueldo, IRPF, Seguridad Social, estancias, renta
- `app.js` · interfaz: formulario, pestañas, tablas, gráficos, comparador, Excel
- `sw.js`, `manifest.webmanifest`, `icono*` · app instalable que funciona sin conexión
- `vendor/xlsx.full.min.js` · SheetJS 0.18.5 para exportar a Excel sin internet

Para generar `calculadora-idom.html` (todo en un archivo) en la raíz:

    node scripts/build.mjs

Al subir a `main`, `.github/workflows/pages.yml` la genera y la publica en GitHub Pages
(en Settings → Pages hay que elegir «Source: GitHub Actions»).
