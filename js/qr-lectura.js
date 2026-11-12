// Lógica pura del lector de QR dentro de la app (F40): sin DOM ni cámara, se prueba con `node --test`
// (tests/qr-lectura.test.mjs). Dos decisiones viven aquí:
//  - qué se acepta de lo que trae un QR. Del texto leído solo se EXTRAE el código de la matera y se sigue por
//    el mismo camino que al escribirlo a mano: nunca se navega a la URL del QR (podría ser de cualquiera);
//  - con qué modo se lee: cámara en vivo, foto o a mano, según lo que el navegador permita.
import { normalizarCodigo, codigoVisible, PREFIJO } from "./vinculacion.js";

export const MENSAJES_QR = {
  ajeno: "Ese QR no es de una matera",
  wifi: "Ese QR es para conectar la matera al Wi-Fi; cuando tenga red mostrará su código",
  vacio: "No se pudo leer el QR. Intenta de nuevo",
};

const fallo = (motivo) => ({ ok: false, motivo, error: MENSAJES_QR[motivo] });

/** La ruta del front que trae un enlace: lo que va después de «#» o, si no hay, el camino de la URL. */
function rutaDelEnlace(texto) {
  const almohadilla = texto.indexOf("#");
  if (almohadilla >= 0) return texto.slice(almohadilla + 1);
  const sinOrigen = texto.replace(/^https?:\/\/[^/]+/i, "");
  return sinOrigen || "/";
}

/**
 * Del texto de un QR al código de la matera. Acepta el enlace de la matera en cualquiera de sus formas
 * (`…/#/v/YUBUD6`, `…/#/vincular?serial=fito-YUBUD6`, con http o https y cualquier host) o el código solo
 * (`YUBUD6`, `fito-YUBUD6`). Devuelve { ok: true, codigo, serial } o { ok: false, motivo, error }, con motivo
 * "wifi" (el QR del portal de la matera), "ajeno" (cualquier otra cosa) o "vacio".
 */
export function codigoDeQr(texto) {
  const crudo = String(texto ?? "").trim();
  if (!crudo) return fallo("vacio");
  if (/^WIFI:/i.test(crudo)) return fallo("wifi");

  if (/^https?:\/\//i.test(crudo)) {
    const ruta = rutaDelEnlace(crudo);
    const corto = /^\/v\/([A-Za-z0-9]{4,12})\/?$/.exec(ruta.split("?")[0]);
    if (corto) return aceptar(`${PREFIJO}${corto[1].toUpperCase()}`);
    const [camino, consulta = ""] = ruta.split("?");
    if (/^\/vincular\/?$/.test(camino)) {
      const serial = new URLSearchParams(consulta).get("serial");
      if (serial) return aceptar(serial.trim());
    }
    return fallo("ajeno");
  }

  // El código solo: seis letras y números, con o sin el prefijo.
  if (/^(fito[-_ ]?)?[A-Za-z0-9]{6}$/i.test(crudo)) return aceptar(crudo);
  return fallo("ajeno");
}

function aceptar(serialOCodigo) {
  const normal = normalizarCodigo(serialOCodigo);
  if (normal.ok) return { ok: true, codigo: normal.codigo, serial: normal.serial };
  // Un serial de fábrica de otro largo (el enlace corto admite de 4 a 12): se respeta tal cual llegó.
  if (/^[A-Za-z0-9._-]{4,64}$/.test(serialOCodigo)) return { ok: true, codigo: codigoVisible(serialOCodigo), serial: serialOCodigo };
  return fallo("ajeno");
}

/**
 * Modos de lectura disponibles, del mejor al de respaldo:
 *  - "vivo": cámara dentro de la página. Exige contexto seguro (HTTPS o localhost) y getUserMedia;
 *  - "foto": se toma una foto con la cámara del sistema y se lee aquí. Funciona también por HTTP;
 *  - "manual": escribir el código. Siempre está.
 */
export function modosDeLector({ contextoSeguro = false, camaraEnVivo = false, foto = false } = {}) {
  const modos = [];
  if (contextoSeguro && camaraEnVivo) modos.push("vivo");
  if (foto) modos.push("foto");
  modos.push("manual");
  return modos;
}

/** El modo principal: el primero de la lista. */
export const modoDeLector = (capacidades) => modosDeLector(capacidades)[0];

/** Tamaño al que se reduce una imagen para leerla: el lado mayor queda en `maximo` como mucho; nunca se agranda. */
export function ladoReducido(ancho, alto, maximo = 1024) {
  const mayor = Math.max(ancho, alto);
  if (!(mayor > 0)) return { ancho: 0, alto: 0 };
  const factor = Math.min(1, maximo / mayor);
  return { ancho: Math.max(1, Math.round(ancho * factor)), alto: Math.max(1, Math.round(alto * factor)) };
}

/** Cuántas pasadas distintas tiene el lector en vivo antes de repetir. */
export const PASADAS_DE_LECTURA = 4;

/**
 * Qué parte del cuadro del video se dibuja en el lienzo en la pasada `indiceDeCuadro` (F41). Cada cuadro hace
 * UNA sola pasada y la siguiente usa la siguiente, en ciclo, para no recargar la CPU:
 *  0. cuadro completo reducido a 640 de lado mayor (rápido, el QR grande);
 *  1. cuadro completo a resolución nativa, hasta 1280 (el QR mediano);
 *  2. centro al 50 % de ancho y alto, a resolución nativa (el QR chico);
 *  3. centro al 30 %, a resolución nativa (el QR de la OLED a 10 o 15 cm: cada módulo conserva sus píxeles).
 * Devuelve { sx, sy, sw, sh, ancho, alto }: los argumentos de `drawImage(video, sx, sy, sw, sh, 0, 0, ancho, alto)`.
 * Nunca se agranda; los recortes también se acotan a 1280 por seguridad.
 */
export function planDeLectura(indiceDeCuadro, anchoVideo, altoVideo) {
  const paso = ((Math.trunc(indiceDeCuadro) || 0) % PASADAS_DE_LECTURA + PASADAS_DE_LECTURA) % PASADAS_DE_LECTURA;
  const fraccion = [1, 1, 0.5, 0.3][paso];
  const maximo = paso === 0 ? 640 : 1280;
  const sw = Math.max(1, Math.round(anchoVideo * fraccion));
  const sh = Math.max(1, Math.round(altoVideo * fraccion));
  const sx = Math.round((anchoVideo - sw) / 2);
  const sy = Math.round((altoVideo - sh) / 2);
  const { ancho, alto } = ladoReducido(sw, sh, maximo);
  return { sx, sy, sw, sh, ancho, alto };
}
