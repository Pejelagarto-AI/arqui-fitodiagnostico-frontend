// Textos de tiempo relativo para los dispositivos. Puro (sin DOM ni red): se prueba con Node.

/** «hace 4 s», «hace 3 min», «hace 2 h». */
export function textoHace(iso, ahora = Date.now()) {
  const segundos = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 1000));
  if (segundos < 60) return `hace ${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h`;
}

/** Estado de un dispositivo reclamado: sin credencial todavía = esperando. */
export function estadoDeDispositivo(dispositivo, ahora = Date.now()) {
  if (!dispositivo.ultimaCredencialEn) return "esperando que se conecte";
  return `conectado ${textoHace(dispositivo.ultimaCredencialEn, ahora)}`;
}
