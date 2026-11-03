# Dependencias vendorizadas

- `gsap.min.js`: GSAP 3.12.5, descargado de https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js (licencia estándar de GreenSock, https://gsap.com/standard-license). Se carga como script clásico antes de `js/app.js` y define `window.gsap`. Solo lo toca `js/animaciones.js`.
- Fuente Nunito (SIL OFL 1.1): `css/fuentes/nunito-latin.woff2`, declarada en `css/fuentes.css`.

Nada se pide a un CDN en tiempo de ejecución: la CSP de `index.html` sigue en `'self'`.
