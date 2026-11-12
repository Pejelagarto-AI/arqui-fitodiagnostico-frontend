// PNG de un QR, sin dependencias: la matriz la da el qrcode-generator vendorizado (js/vendor/qrcode.js) y el
// PNG se arma a mano (escala de grises de 8 bits, zlib de Node). Lo usa el humo para probar el lector de QR por
// el camino de la foto (F40): la «foto» que se sube es este PNG.
import { createRequire } from "node:module";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);
const qrcode = require("../../js/vendor/qrcode.js");

/** Matriz de módulos (true = oscuro) con su zona quieta alrededor. */
export function matrizDeQr(texto, { margen = 4 } = {}) {
  const qr = qrcode(0, "M");
  qr.addData(texto);
  qr.make();
  const cuenta = qr.getModuleCount();
  const lado = cuenta + margen * 2;
  const filas = [];
  for (let f = 0; f < lado; f++) {
    const fila = [];
    for (let c = 0; c < lado; c++) {
      const dentro = f >= margen && c >= margen && f < margen + cuenta && c < margen + cuenta;
      fila.push(dentro ? qr.isDark(f - margen, c - margen) : false);
    }
    filas.push(fila);
  }
  return filas;
}

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function trozo(tipo, datos) {
  const cabeza = Buffer.alloc(4);
  cabeza.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "latin1"), datos]);
  const cola = Buffer.alloc(4);
  cola.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([cabeza, cuerpo, cola]);
}

/** PNG (Buffer) del QR de `texto`. `invertido`: módulos claros sobre fondo oscuro, como una pantalla OLED. */
export function pngDeQr(texto, { escala = 8, margen = 4, invertido = false } = {}) {
  const matriz = matrizDeQr(texto, { margen });
  const lado = matriz.length * escala;
  const crudo = Buffer.alloc((lado + 1) * lado);
  for (let y = 0; y < lado; y++) {
    crudo[y * (lado + 1)] = 0; // filtro «ninguno»
    for (let x = 0; x < lado; x++) {
      const oscuro = matriz[Math.floor(y / escala)][Math.floor(x / escala)] !== invertido;
      crudo[y * (lado + 1) + 1 + x] = oscuro ? 0 : 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // bits por muestra
  ihdr[9] = 0; // escala de grises
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo("IHDR", ihdr), trozo("IDAT", zlib.deflateSync(crudo)), trozo("IEND", Buffer.alloc(0))]);
}

/**
 * Video Y4M (Buffer) con el QR quieto en el centro de un cuadro de 640x480: sirve de cámara falsa de Chrome
 * (`--use-file-for-fake-video-capture`) para probar el lector en vivo.
 */
export function y4mDeQr(texto, { cuadros = 10, ancho = 640, alto = 480, escala = 8 } = {}) {
  const matriz = matrizDeQr(texto);
  const lado = matriz.length * escala;
  const x0 = Math.floor((ancho - lado) / 2);
  const y0 = Math.floor((alto - lado) / 2);
  const luma = Buffer.alloc(ancho * alto, 200); // pared gris clara alrededor
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      if (y0 + y < 0 || y0 + y >= alto || x0 + x < 0 || x0 + x >= ancho) continue;
      luma[(y0 + y) * ancho + x0 + x] = matriz[Math.floor(y / escala)][Math.floor(x / escala)] ? 16 : 235;
    }
  }
  const croma = Buffer.alloc((ancho / 2) * (alto / 2) * 2, 128);
  const partes = [Buffer.from(`YUV4MPEG2 W${ancho} H${alto} F10:1 Ip A1:1 C420jpeg\n`, "latin1")];
  for (let i = 0; i < cuadros; i++) partes.push(Buffer.from("FRAME\n", "latin1"), luma, croma);
  return Buffer.concat(partes);
}
