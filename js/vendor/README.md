# Dependencias vendorizadas

- `gsap.min.js`: GSAP 3.12.5, descargado de https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js (licencia estándar de GreenSock, https://gsap.com/standard-license). Se carga como script clásico antes de `js/app.js` y define `window.gsap`. Solo lo toca `js/animaciones.js`.
- Fuente Nunito (SIL OFL 1.1): `css/fuentes/nunito-latin.woff2`, declarada en `css/fuentes.css`.

Nada se pide a un CDN en tiempo de ejecución: la CSP de `index.html` sigue en `'self'`.
- `qrcode.js`: qrcode-generator 2.0.4 (MIT, Kazuhiko Arase), `dist/qrcode.js` del paquete npm sin cambios, con dos líneas de encabezado. Un solo archivo sin dependencias; define el global `qrcode`. Lo carga `js/componentes/qr.js` bajo demanda (la vista de dispositivos de fábrica) y solo se usa su matriz de módulos: el SVG lo construye el front con `createElementNS`.
