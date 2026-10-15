// Codec de STOMP 1.2: texto <-> tramas. Sin red y sin DOM, por eso se prueba
// con `node --test` (tests/stomp.test.mjs). Quien abre el WebSocket es envivo.js.
//
// Una trama es: COMANDO\ncabecera:valor\n...\n\ncuerpo\0
// Los latidos (heart-beat) son un "\n" suelto entre tramas y se ignoran.

const SIN_ESCAPE = new Set(["CONNECT", "CONNECTED"]);

function escaparValor(valor) {
  return String(valor).replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/:/g, "\\c");
}

function desescaparValor(valor) {
  return valor.replace(/\\(r|n|c|\\)/g, (_, c) => ({ r: "\r", n: "\n", c: ":", "\\": "\\" })[c]);
}

export function codificar(comando, cabeceras = {}, cuerpo = "") {
  const escapar = !SIN_ESCAPE.has(comando);
  const lineas = Object.entries(cabeceras).map(
    ([clave, valor]) => `${clave}:${escapar ? escaparValor(valor) : valor}`,
  );
  return `${[comando, ...lineas].join("\n")}\n\n${cuerpo}\0`;
}

/** Devuelve las tramas completas contenidas en `texto` (un mensaje de WebSocket). */
export function decodificar(texto) {
  const tramas = [];
  for (const parte of texto.split("\0")) {
    const trama = parte.replace(/^[\r\n]+/, "");
    if (trama === "") continue;
    const corte = trama.indexOf("\n\n");
    const encabezado = corte === -1 ? trama : trama.slice(0, corte);
    const cuerpo = corte === -1 ? "" : trama.slice(corte + 2);
    const [primera, ...resto] = encabezado.split("\n");
    const comando = primera.trim();
    const escapar = !SIN_ESCAPE.has(comando);
    const cabeceras = {};
    for (const linea of resto) {
      const i = linea.indexOf(":");
      if (i <= 0) continue;
      const clave = linea.slice(0, i);
      // STOMP 1.2: si una cabecera se repite, vale la primera.
      if (!(clave in cabeceras)) {
        const valor = linea.slice(i + 1).replace(/\r$/, "");
        cabeceras[clave] = escapar ? desescaparValor(valor) : valor;
      }
    }
    tramas.push({ comando, cabeceras, cuerpo });
  }
  return tramas;
}
