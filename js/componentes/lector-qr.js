// Lector de QR dentro de la app (F40): el usuario lee el QR de la pantalla de su matera sin salir a la
// cámara del teléfono. Mejora progresiva (la decide js/qr-lectura.js):
//  - EN VIVO: con contexto seguro (HTTPS o localhost) y getUserMedia, el video de la cámara trasera se ve
//    dentro de la tarjeta con una mira; se lee un cuadro unas nueve veces por segundo y, al encontrar el QR de
//    una matera, la cámara se apaga y el asistente avanza solo;
//  - FOTO: sin contexto seguro (el front por HTTP) o sin getUserMedia, un <input type="file" capture> abre la
//    cámara del sistema, vuelve con la foto y se lee aquí. No saca al usuario de la app;
//  - A MANO: escribir el código. Siempre está, lo ofrece quien usa este componente.
// Del QR solo se saca el código: nunca se abre ni se navega al enlace que trae.
import { h, svg } from "../ui.js";
import { barrerMira, movimientoReducido } from "../animaciones.js";
import { codigoDeQr, modosDeLector, ladoReducido, planDeLectura } from "../qr-lectura.js";

const CUADROS_POR_SEGUNDO = 9;
const LADO_DE_FOTO = 1024;

/** Lo que este navegador puede hacer, para decidir el modo. */
export function capacidadesDelNavegador(ventana = globalThis) {
  const navegador = ventana.navigator || {};
  return {
    contextoSeguro: ventana.isSecureContext === true,
    camaraEnVivo: Boolean(navegador.mediaDevices && typeof navegador.mediaDevices.getUserMedia === "function"),
    foto: typeof ventana.FileReader === "function" || typeof ventana.createImageBitmap === "function",
  };
}

let cargaDeJsQr = null;

/** Carga js/vendor/jsQR.js una sola vez (script clásico del mismo origen: la CSP `script-src 'self'` lo admite). */
function cargarJsQr() {
  if (globalThis.jsQR) return Promise.resolve(globalThis.jsQR);
  if (!cargaDeJsQr) {
    cargaDeJsQr = new Promise((resolver, rechazar) => {
      const script = document.createElement("script");
      script.src = new URL("../vendor/jsQR.js", import.meta.url).href;
      script.onload = () => resolver(globalThis.jsQR);
      script.onerror = () => {
        cargaDeJsQr = null;
        rechazar(new Error("No se pudo cargar el lector de QR."));
      };
      document.head.append(script);
    });
  }
  return cargaDeJsQr;
}

/**
 * Devuelve `leer(lienzo, nativa)` -> texto del QR o null. Si el navegador trae BarcodeDetector con QR (Chrome en
 * Android) se intenta primero con él, que es nativo; si no ve nada (o no existe) lee jsQR, que además prueba la
 * imagen invertida: la pantalla OLED de la matera puede mostrar el QR claro sobre fondo oscuro.
 */
async function prepararDecodificador() {
  let nativo = null;
  try {
    if ("BarcodeDetector" in globalThis) {
      const formatos = await globalThis.BarcodeDetector.getSupportedFormats();
      if (formatos.includes("qr_code")) nativo = new globalThis.BarcodeDetector({ formats: ["qr_code"] });
    }
  } catch {
    nativo = null;
  }
  const jsQR = await cargarJsQr();
  // `nativa`: fuente a resolución completa (el video) para el detector nativo, en vez del lienzo reducido.
  return async (lienzo, nativa = null) => {
    if (nativo) {
      try {
        const hallados = await nativo.detect(nativa || lienzo);
        if (hallados.length && hallados[0].rawValue) return hallados[0].rawValue;
      } catch {
        // el detector nativo puede fallar con un cuadro a medio pintar: se sigue con jsQR
      }
    }
    const contexto = lienzo.getContext("2d", { willReadFrequently: true });
    const imagen = contexto.getImageData(0, 0, lienzo.width, lienzo.height);
    const hallado = jsQR(imagen.data, imagen.width, imagen.height, { inversionAttempts: "attemptBoth" });
    return hallado && hallado.data ? hallado.data : null;
  };
}

/** De un archivo de imagen a algo que se pueda dibujar en un canvas. */
async function imagenDeArchivo(archivo) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(archivo);
    } catch {
      // algunos navegadores no decodifican HEIC u otros formatos con createImageBitmap: se intenta con <img>
    }
  }
  // Respaldo con una URL de datos (la CSP admite `img-src data:`, no `blob:`).
  const datos = await new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = () => rechazar(lector.error || new Error("No se pudo leer la foto."));
    lector.readAsDataURL(archivo);
  });
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error("No se pudo abrir la foto."));
    imagen.src = datos;
  });
}

function mira() {
  const esquina = (d) => svg("path", { d, class: "lector-mira-esquina" });
  const linea = svg("path", { d: "M14 50h72", class: "lector-mira-linea" });
  const nodo = svg("svg", { class: "lector-mira", viewBox: "0 0 100 100", "aria-hidden": "true", focusable: "false" },
    esquina("M8 26V14a6 6 0 0 1 6-6h12"), esquina("M74 8h12a6 6 0 0 1 6 6v12"),
    esquina("M92 74v12a6 6 0 0 1-6 6H74"), esquina("M26 92H14a6 6 0 0 1-6-6V74"), linea);
  return { nodo, linea };
}

const iconoCamara = () => svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false", class: "lector-icono" },
  svg("path", { d: "M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.2-2h6.2l1.2 2h1.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" }),
  svg("circle", { cx: 12, cy: 12.5, r: 3.4 }));

/**
 * Crea el lector. `alLeer({ codigo, serial })` decide qué pasa con una matera leída: devuelve `true` si la
 * aceptó (el lector se apaga) o un texto con el motivo si no (se muestra y se sigue leyendo).
 * `reposo`: nodo que se ve mientras la cámara está apagada (la ilustración del paso).
 * Devuelve { nodo, detener, modos }.
 */
export function crearLectorQr({ alLeer, reposo = null, capacidades = capacidadesDelNavegador() }) {
  const modos = modosDeLector(capacidades);
  const estado = h("p", { class: "lector-estado", id: "lector-estado", role: "status", "aria-live": "polite" });
  const decir = (texto, tipo = "info") => {
    estado.textContent = texto;
    estado.dataset.tipo = tipo;
  };

  // iOS exige playsinline, muted y autoplay para pintar el video dentro de la página (si no, lo abre a pantalla completa).
  const video = h("video", { class: "lector-video", id: "lector-video", playsinline: true, muted: true, autoplay: true, "aria-label": "Vista de la cámara" });
  video.muted = true;
  const { nodo: nodoMira, linea } = mira();
  const cerrar = h("button", { type: "button", class: "lector-cerrar", id: "btn-lector-cerrar", "aria-label": "Cerrar la cámara" },
    svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" }, svg("path", { d: "M6 6l12 12M18 6L6 18", "stroke-width": 2.6, "stroke-linecap": "round", fill: "none", stroke: "currentColor" })));
  const visor = h("div", { class: "lector-visor", id: "lector-visor", hidden: true }, video, nodoMira, cerrar);
  const cajaReposo = reposo ? h("div", { class: "lector-reposo" }, reposo) : null;

  const lienzo = document.createElement("canvas");
  let flujo = null; // MediaStream de la cámara
  let reloj = null;
  let ocupado = false;
  let indiceDeCuadro = 0;
  let pararMira = () => {};
  let decodificador = null;
  let ultimoRechazo = { texto: null, en: 0 };
  let destruido = false;

  const decodificar = async (fuente, nativa = null) => {
    if (!decodificador) decodificador = prepararDecodificador();
    return (await decodificador)(fuente, nativa);
  };

  /** Texto de un QR -> matera aceptada (true) o mensaje. */
  function procesar(texto) {
    const leido = codigoDeQr(texto);
    if (!leido.ok) {
      decir(`${leido.error}.`, "error");
      return false;
    }
    const respuesta = alLeer({ codigo: leido.codigo, serial: leido.serial });
    if (respuesta === true) {
      if (typeof navigator.vibrate === "function") navigator.vibrate(60);
      return true;
    }
    decir(String(respuesta || "Ese código no sirvió. Revisa la pantalla de la matera."), "error");
    return false;
  }

  function detener() {
    clearInterval(reloj);
    reloj = null;
    pararMira();
    pararMira = () => {};
    if (flujo) {
      for (const pista of flujo.getTracks()) pista.stop();
      flujo = null;
    }
    video.srcObject = null;
    visor.hidden = true;
    if (cajaReposo) cajaReposo.hidden = false;
    acciones.hidden = false;
  }

  async function cuadro() {
    if (ocupado || !flujo || video.readyState < 2 || !video.videoWidth) return;
    ocupado = true;
    try {
      // Una sola pasada por cuadro; la siguiente usa otra escala o recorte (planDeLectura). El lienzo es el mismo.
      const indice = indiceDeCuadro++;
      const { sx, sy, sw, sh, ancho, alto } = planDeLectura(indice, video.videoWidth, video.videoHeight);
      if (lienzo.width !== ancho) lienzo.width = ancho;
      if (lienzo.height !== alto) lienzo.height = alto;
      lienzo.getContext("2d", { willReadFrequently: true }).drawImage(video, sx, sy, sw, sh, 0, 0, ancho, alto);
      // BarcodeDetector ve el video a resolución nativa en las pasadas de cuadro completo; en los recortes, el lienzo.
      const texto = await decodificar(lienzo, sw === video.videoWidth ? video : null);
      if (!texto || !flujo) return;
      // El mismo QR rechazado sigue frente a la cámara: no se repite el aviso en cada cuadro.
      if (texto === ultimoRechazo.texto && Date.now() - ultimoRechazo.en < 2500) return;
      if (procesar(texto)) detener();
      else ultimoRechazo = { texto, en: Date.now() };
    } catch {
      // un cuadro que no se pudo leer no detiene la cámara
    } finally {
      ocupado = false;
    }
  }

  async function abrirCamara() {
    decir("Abriendo la cámara…");
    botonCamara.disabled = true;
    try {
      // Más resolución: el QR de la OLED (29 módulos en 58 px) a 10 o 15 cm ocupa poco del cuadro.
      flujo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (destruido) {
        for (const pista of flujo.getTracks()) pista.stop();
        flujo = null;
        return;
      }
      // Enfoque continuo si el navegador lo admite; iOS lo ignora o lo rechaza y no pasa nada.
      try {
        const pista = flujo.getVideoTracks()[0];
        if (pista && typeof pista.applyConstraints === "function") await pista.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
      } catch {
        // sin enfoque continuo se lee igual
      }
      video.srcObject = flujo;
      visor.hidden = false;
      if (cajaReposo) cajaReposo.hidden = true;
      acciones.hidden = true;
      await video.play().catch(() => {}); // autoplay ya lo arranca; play() cubre a los navegadores que lo piden
      decir("Buscando el QR…");
      visor.scrollIntoView({ block: "center", behavior: movimientoReducido() ? "auto" : "smooth" });
      pararMira = barrerMira(linea);
      // La librería se pide ya, mientras el usuario apunta.
      decodificador = decodificador || prepararDecodificador();
      decodificador.catch(() => {
        decodificador = null;
        detener();
        decir("No se pudo cargar el lector de QR. Revisa la conexión o escribe el código.", "error");
      });
      indiceDeCuadro = 0;
      reloj = setInterval(cuadro, Math.round(1000 / CUADROS_POR_SEGUNDO));
      cerrar.focus({ preventScroll: true });
    } catch (error) {
      detener();
      const nombre = error && error.name;
      if (nombre === "NotAllowedError" || nombre === "SecurityError") {
        decir(modos.includes("foto") ? "No tenemos permiso para usar la cámara. Puedes tomar una foto del QR o escribir el código." : "No tenemos permiso para usar la cámara. Escribe el código.", "error");
      } else if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
        decir("No encontramos una cámara en este dispositivo. Toma una foto del QR o escribe el código.", "error");
      } else {
        decir("No se pudo abrir la cámara. Toma una foto del QR o escribe el código.", "error");
      }
    } finally {
      botonCamara.disabled = false;
    }
  }

  async function leerFoto(archivo) {
    decir("Leyendo la foto…");
    try {
      const imagen = await imagenDeArchivo(archivo);
      const anchoReal = imagen.width || imagen.naturalWidth;
      const altoReal = imagen.height || imagen.naturalHeight;
      const contexto = lienzo.getContext("2d", { willReadFrequently: true });
      // Primer intento: la foto entera reducida. Segundo: el centro a más detalle (el QR de la matera es chico).
      const intentos = [[0, 0, anchoReal, altoReal], [anchoReal / 4, altoReal / 4, anchoReal / 2, altoReal / 2]];
      let texto = null;
      for (const [x, y, w, a] of intentos) {
        const { ancho, alto } = ladoReducido(w, a, LADO_DE_FOTO);
        if (!ancho || !alto) break;
        lienzo.width = ancho;
        lienzo.height = alto;
        contexto.drawImage(imagen, x, y, w, a, 0, 0, ancho, alto);
        texto = await decodificar(lienzo);
        if (texto) break;
      }
      if (typeof imagen.close === "function") imagen.close();
      if (destruido) return;
      if (!texto) {
        decir("No vimos un QR en la foto. Acércate hasta que el cuadro llene la pantalla y vuelve a intentar.", "error");
        return;
      }
      if (procesar(texto)) decir("");
    } catch {
      decodificador = null;
      if (!destruido) decir("No se pudo leer esa foto. Intenta otra vez o escribe el código.", "error");
    }
  }

  // ---- acciones según el modo ----
  const botonCamara = h("button", { type: "button", class: "boton boton-primario lector-accion", id: "btn-lector-camara", onclick: abrirCamara }, iconoCamara(), "Escanear con la cámara");
  // El campo de archivo está oculto a la vista pero no con display:none: iOS no siempre lo abre si no existe en el árbol visible.
  const archivo = h("input", { type: "file", accept: "image/*", capture: "environment", class: "lector-archivo", id: "lector-foto", tabindex: "-1", "aria-hidden": "true" });
  archivo.addEventListener("change", () => {
    const elegido = archivo.files && archivo.files[0];
    archivo.value = ""; // la misma foto se puede volver a elegir
    if (elegido) leerFoto(elegido);
  });
  const enVivo = modos.includes("vivo");
  const conFoto = modos.includes("foto");
  const botonFoto = h("button", { type: "button", class: `boton ${enVivo ? "boton-secundario" : "boton-primario"} lector-accion`, id: "btn-lector-foto", onclick: () => archivo.click() }, enVivo ? null : iconoCamara(), "Tomar foto del QR");
  const acciones = h("div", { class: "lector-acciones" }, enVivo ? botonCamara : null, conFoto ? [botonFoto, archivo] : null);
  if (!enVivo && !conFoto) decir("Este navegador no puede leer el QR. Escribe el código de la pantalla de la matera.");

  cerrar.addEventListener("click", () => {
    detener();
    decir("");
    (enVivo ? botonCamara : botonFoto).focus({ preventScroll: true });
  });
  // La cámara no se queda prendida a escondidas: se apaga cuando la pestaña pasa a segundo plano.
  const alOcultar = () => {
    if (document.visibilityState === "hidden" && flujo) {
      detener();
      decir("Apagamos la cámara mientras no mirabas. Tócala para volver a abrirla.");
    }
  };
  document.addEventListener("visibilitychange", alOcultar);

  const nodo = h("div", { class: "lector", "data-modo": modos[0] }, cajaReposo, visor, estado, acciones);
  return {
    nodo,
    modos,
    /** Apaga la cámara (al cambiar de opción dentro del paso). */
    detener,
    /** Apaga todo y suelta los oyentes (al salir del paso o de la pantalla). */
    destruir() {
      destruido = true;
      detener();
      document.removeEventListener("visibilitychange", alOcultar);
    },
  };
}
