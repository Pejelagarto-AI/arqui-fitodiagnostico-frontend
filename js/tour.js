// Recorrido guiado (F39): lógica pura, sin DOM (tests/tour.test.mjs). La primera vez que alguien ve su
// tablero con plantas, y la primera vez que abre una planta, un recorrido de pocas paradas le muestra qué es
// cada cosa sobre la pantalla real: un foco sobre el elemento y un globo con una o dos frases.
// Aquí vive lo que se puede probar sin navegador: qué paradas hay, cuándo toca mostrarlo, cómo se recuerda
// que ya se vio y dónde va el globo para que nunca tape lo que explica. El DOM está en componentes/recorrido.js.

/** Claves de almacenamiento. `fito.tour = "no"` lo apaga del todo (lo pone la prueba de humo). */
export const CLAVE_APAGADO = "fito.tour";
export const claveDeVisto = (nombre) => `fito.tour.${nombre}`;

/**
 * Paradas de cada recorrido. `selector` es el elemento real que se enfoca (si son varios, el primero que
 * exista y se vea). `respaldo` es otra parada que ocupa su lugar cuando el elemento no está (una planta sin
 * lecturas todavía no tiene valores que mostrar). Las que no tienen elemento ni respaldo se saltan.
 */
export const RECORRIDOS = {
  tablero: [
    { clave: "resumen", selector: "#resumen-plantas", titulo: "Tus plantas de un vistazo", texto: "Cuántas están bien y cuántas piden algo. Toca un estado para ver solo esas." },
    { clave: "planta", selector: ".tarjeta-planta-item:not([hidden]) .tarjeta-planta", titulo: "Cada planta, un renglón", texto: "El color y la etiqueta dicen cómo está. Tócala para ver sus valores." },
    { clave: "pendientes", selector: "#que-hacer-hoy", titulo: "Qué hacer hoy", texto: "Lo que piden tus plantas ahora mismo, lo más urgente primero." },
    { clave: "agregar", selector: "#enlace-nueva-planta", titulo: "¿Tienes otra planta?", texto: "Agrégala aquí cuando quieras." },
    { clave: "navegacion", selector: "#barra-inferior, #navegacion", titulo: "Muévete por la app", texto: "Tus plantas, un diagnóstico rápido, las especies y tu perfil. En Perfil puedes repetir este recorrido." },
  ],
  detalle: [
    { clave: "estado", selector: ".cabecera-planta", titulo: "Así está tu planta", texto: "Arriba siempre ves cómo está. El punto verde dice hace cuánto llegó la última lectura." },
    { clave: "pestanas", selector: ".pestanas", titulo: "Todo en cuatro pestañas", texto: "«Hoy» es lo de todos los días. En «Historial» quedan las lecturas anteriores." },
    {
      clave: "valores", selector: "#panel-hoy .burbuja", titulo: "Cada valor con su rango", texto: "La franja verde es lo ideal para tu planta. Si la barra se sale de ella, te lo marcamos.",
      respaldo: { clave: "sin-valores", selector: "#panel-hoy #diagnostico-vigente", titulo: "Aquí verás sus valores", texto: "Cuando llegue la primera lectura aparecerán el agua, la luz y la temperatura, cada una con su rango ideal." },
    },
    { clave: "matera", selector: "#pestana-matera", titulo: "Tu matera", texto: "Aquí ves si está conectada y puedes vincular una nueva." },
    { clave: "que-hacer", selector: "#panel-hoy .que-hacer", titulo: "Qué hacer hoy", texto: "Si a tu planta le falta algo, aquí te decimos qué hacer." },
  ],
};

/**
 * Las paradas que de verdad se pueden mostrar: `existe(selector)` dice si hay un elemento visible para ese
 * selector. Una parada sin elemento usa su respaldo si lo tiene y está; si no, se salta.
 */
export function paradasDisponibles(paradas, existe) {
  const lista = [];
  for (const parada of paradas) {
    if (existe(parada.selector)) lista.push(parada);
    else if (parada.respaldo && existe(parada.respaldo.selector)) lista.push(parada.respaldo);
  }
  return lista;
}

/** Menos de dos paradas no es un recorrido: mejor no interrumpir. */
export const MINIMO_DE_PARADAS = 2;

// ---- cuándo toca ----

/** ¿Está apagado? Por `?tour=no` (antes o después del «#») o por la clave de almacenamiento. */
export function recorridoApagado({ busqueda = "", consultaDelHash = "", almacenado = null } = {}) {
  const dice = (texto) => new URLSearchParams(texto).get("tour") === "no";
  return dice(busqueda) || dice(consultaDelHash) || almacenado === "no";
}

/**
 * Memoria de lo visto. `almacen` es localStorage o algo con su forma (o null si no hay): si falla o no existe
 * (modo privado, almacenamiento bloqueado), queda en `memoria`, que dura lo que la pestaña. El recorrido
 * funciona igual; solo que se volvería a ver en otra visita.
 */
export function crearMemoria(almacen, memoria = new Map()) {
  const leer = (clave) => {
    try {
      const valor = almacen ? almacen.getItem(clave) : null;
      return valor ?? memoria.get(clave) ?? null;
    } catch {
      return memoria.get(clave) ?? null;
    }
  };
  const guardar = (clave, valor) => {
    memoria.set(clave, valor);
    try {
      if (almacen) almacen.setItem(clave, valor);
    } catch {
      // sin almacenamiento: la memoria de la pestaña basta
    }
  };
  const borrar = (clave) => {
    memoria.delete(clave);
    try {
      if (almacen) almacen.removeItem(clave);
    } catch {
      // nada que borrar
    }
  };
  return {
    visto: (nombre) => leer(claveDeVisto(nombre)) === "visto",
    marcarVisto: (nombre) => guardar(claveDeVisto(nombre), "visto"),
    /** «Ver el recorrido otra vez»: olvida todos. */
    olvidar: () => Object.keys(RECORRIDOS).forEach((nombre) => borrar(claveDeVisto(nombre))),
    apagado: () => leer(CLAVE_APAGADO),
  };
}

/** ¿Se muestra ahora? Solo si no está apagado, no se ha visto, no hay otro abierto y hay paradas suficientes. */
export function tocaMostrar({ apagado, visto, abierto, paradas }) {
  return !apagado && !visto && !abierto && paradas >= MINIMO_DE_PARADAS;
}

// ---- pasos ----

/** Índice de la parada siguiente, o null si esa era la última (el recorrido termina). */
export function siguienteParada(indice, total) {
  return indice + 1 < total ? indice + 1 : null;
}

export function paradaAnterior(indice) {
  return Math.max(0, indice - 1);
}

/** Lo que oye un lector de pantalla en cada parada: «Paso 2 de 5. Título. Texto». */
export function anuncioDeParada(parada, indice, total) {
  return `Paso ${indice + 1} de ${total}. ${parada.titulo}. ${parada.texto}`;
}

// ---- geometría: el globo nunca tapa lo que explica ----

const acotar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));

/**
 * Dónde debe quedar el borde superior del elemento en la ventana antes de enfocarlo: centrado junto con su
 * globo si los dos caben; si no, arriba, para que se vea su principio.
 */
export function topeDeseado({ altoObjetivo, altoGlobo, altoVentana, margen = 12, borde = 16 }) {
  const conjunto = altoObjetivo + margen + altoGlobo;
  if (conjunto + borde * 2 <= altoVentana) return Math.round((altoVentana - conjunto) / 2);
  return borde;
}

/**
 * Coloca el foco (el recorte iluminado) y el globo. Todo en coordenadas de la ventana.
 *  - objetivo: { top, left, width, height } del elemento; ventana: { ancho, alto }; globo: { ancho, alto }.
 * El globo va debajo si cabe, si no arriba; si no cabe en ningún lado (el elemento es más alto que la
 * pantalla) el foco se acorta por abajo y el globo va debajo del trozo iluminado. Devuelve
 * { foco: { top, left, width, height }, globo: { top, left }, lado: "abajo" | "arriba", flecha } con `flecha`
 * = distancia en px desde el borde izquierdo del globo hasta el centro del elemento.
 */
export function colocar({ objetivo, ventana, globo, margen = 12, relleno = 6, borde = 8 }) {
  const left = acotar(objetivo.left - relleno, borde / 2, Math.max(borde / 2, ventana.ancho - borde));
  const derecha = acotar(objetivo.left + objetivo.width + relleno, left + 24, ventana.ancho - borde / 2);
  const top = acotar(objetivo.top - relleno, borde / 2, Math.max(borde / 2, ventana.alto - 48));
  const abajo = acotar(objetivo.top + objetivo.height + relleno, top + 24, ventana.alto - borde / 2);
  const foco = { top, left, width: derecha - left, height: abajo - top };

  const necesita = globo.alto + margen;
  const sitioAbajo = ventana.alto - borde - (foco.top + foco.height);
  const sitioArriba = foco.top - borde;
  let lado = "abajo";
  if (sitioAbajo >= necesita) lado = "abajo";
  else if (sitioArriba >= necesita) lado = "arriba";
  else {
    // No cabe entero ni arriba ni abajo: se ilumina solo el principio del elemento y el globo va debajo.
    foco.height = Math.max(40, ventana.alto - borde - necesita - foco.top);
  }
  const topGlobo = lado === "abajo" ? foco.top + foco.height + margen : foco.top - margen - globo.alto;
  const centro = foco.left + foco.width / 2;
  const leftGlobo = acotar(centro - globo.ancho / 2, borde, Math.max(borde, ventana.ancho - globo.ancho - borde));
  return {
    foco,
    globo: { top: Math.round(topGlobo), left: Math.round(leftGlobo) },
    lado,
    flecha: Math.round(acotar(centro - leftGlobo, 22, Math.max(22, globo.ancho - 22))),
  };
}
