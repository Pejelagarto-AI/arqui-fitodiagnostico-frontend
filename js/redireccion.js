// Los correos del backend arman enlaces de camino (/invitacion?token=..., /restablecer?token=...)
// cuando FITO_FRONT_URL es solo el origen. Este front enruta por hash, así que
// esas dos rutas existen como páginas mínimas que reenvían a #/<ruta>?token=...
// (ver README: la alternativa es FITO_FRONT_URL=http://host:5500/#).
const ruta = document.documentElement.dataset.ruta;
window.location.replace(`../#/${ruta}${window.location.search}`);
