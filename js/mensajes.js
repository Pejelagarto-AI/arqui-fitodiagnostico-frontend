// Mensajes de error en lenguaje de persona (pasada de textos, F38): lógica pura, probada con Node
// (tests/mensajes.test.mjs). Los errores llegan como ErrorApi (js/api.js), con el código y el mensaje que
// redacta el servidor. Aquí se decide qué lee el usuario:
//  - lo que es de la tubería (no hay red, respuesta rara) se dice sin jerga y con qué hacer;
//  - el mensaje del servidor, que ya viene en español, se muestra con mayúscula inicial y punto final.

const FRASES_POR_CODIGO = {
  API_NO_DISPONIBLE: "No pudimos conectarnos. Revisa tu internet y vuelve a intentar.",
  RESPUESTA_INVALIDA: "Algo falló de nuestro lado. Intenta de nuevo en un momento.",
  ERROR_DESCONOCIDO: "Algo falló de nuestro lado. Intenta de nuevo en un momento.",
};

/** Mayúscula inicial y punto final, sin tocar lo de en medio. */
export function comoFrase(texto) {
  const limpio = String(texto ?? "").trim();
  if (!limpio) return "";
  const conMayuscula = limpio.charAt(0).toUpperCase() + limpio.slice(1);
  return /[.!?…»)]$/.test(conMayuscula) ? conMayuscula : `${conMayuscula}.`;
}

/** Lo que se le muestra al usuario a partir de un ErrorApi, un Error o un texto. */
export function mensajeParaPersona(error) {
  if (typeof error === "string") return comoFrase(error);
  if (!error) return FRASES_POR_CODIGO.ERROR_DESCONOCIDO;
  const propia = FRASES_POR_CODIGO[error.codigo];
  // «ERROR_DESCONOCIDO» con mensaje del servidor: vale más el mensaje.
  if (propia && (error.codigo !== "ERROR_DESCONOCIDO" || !error.mensaje || /consultando la API/i.test(error.mensaje))) return propia;
  return comoFrase(error.mensaje || error.message || String(error));
}
