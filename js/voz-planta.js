// La voz de la planta (F38): lógica pura, sin DOM (tests/voz-planta.test.mjs). Convierte un diagnóstico en
// lo que la planta «diría» en primera persona. Es la promesa de la portada («Tu planta te dice cómo está»)
// llevada al resultado del diagnóstico sin cuenta y a la pestaña «Hoy».

const QUEJAS = {
  humedad: { BAJO: "Tengo sed", ALTO: "Tengo demasiada agua" },
  luz: { BAJO: "Me falta luz", ALTO: "Me da demasiada luz" },
  temperatura: { BAJO: "Tengo frío", ALTO: "Tengo calor" },
};

const enMinuscula = (texto) => texto.charAt(0).toLowerCase() + texto.slice(1);

/** Lo que dice la planta según su diagnóstico: «Tengo sed y me falta luz.» o «Estoy bien. Hoy no necesito nada.». */
export function fraseDePlanta(diagnostico) {
  if (!diagnostico || !Array.isArray(diagnostico.parametros)) return "Todavía no sé cómo estoy.";
  const quejas = diagnostico.parametros
    .filter((p) => p.estado !== "OPTIMO")
    .map((p) => QUEJAS[p.nombre] && QUEJAS[p.nombre][p.estado])
    .filter(Boolean);
  if (quejas.length === 0) return "Estoy bien. Hoy no necesito nada.";
  if (quejas.length === 1) return `${quejas[0]}.`;
  const ultima = enMinuscula(quejas[quejas.length - 1]);
  const antes = quejas.slice(0, -1).map((q, i) => (i === 0 ? q : enMinuscula(q)));
  return `${antes.join(", ")} y ${ultima}.`;
}

/** Ayuda fija de cada magnitud, en lenguaje de persona: qué es y un ejemplo cotidiano. */
export const AYUDA_DE_MAGNITUD = {
  humedad: "Qué tan mojada está la tierra: 0 es seca del todo y 100, encharcada.",
  luz: "Cuánta luz le llega. Una sala iluminada ronda 300 a 500 lux; junto a una ventana, 1000 o más.",
  temperatura: "La del aire junto a la planta.",
};

/** «Para un potos lo ideal es de 40 a 70 %.» Sin rango (aún no se eligió la planta), cadena vacía. */
export function textoDeRangoIdeal(rango, especie) {
  if (!rango || !Number.isFinite(rango.min) || !Number.isFinite(rango.max)) return "";
  const quien = especie ? `Para ${articulo(especie)} ${especie}` : "Para esta planta";
  return `${quien} lo ideal es de ${rango.min} a ${rango.max} ${rango.unidad}.`;
}

/** «un potos», «una lavanda»: por la terminación, que acierta con el catálogo y no pretende ser gramática. */
function articulo(especie) {
  return /a$/i.test(String(especie).trim()) ? "una" : "un";
}

const numero = (n) => String(Number(Number(n).toFixed(1)));
const conMayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * Una recomendación del servidor en lenguaje de persona. El servidor la redacta así:
 * «Humedad del sustrato 30 % por debajo del rango óptimo 40–70 %: regar moderadamente.». Aquí se parte en
 * la ACCIÓN, que es lo que importa («Regar moderadamente.»), y el porqué con las palabras del resto de la
 * app («La tierra está en 30 %; lo ideal es de 40 a 70 %.»). Si el texto no trae esa forma o no se sabe de
 * qué parámetro es, se deja tal cual como acción y sin detalle: nunca se inventa.
 */
export function recomendacionEnPalabras(texto, parametro) {
  const crudo = String(texto ?? "").trim();
  const corte = crudo.lastIndexOf(": ");
  if (!parametro || corte < 0 || corte + 2 >= crudo.length) return { accion: crudo, detalle: "" };
  const accion = `${conMayuscula(crudo.slice(corte + 2).replace(/\.+$/, ""))}.`;
  const rango = parametro.rangoOptimo;
  if (!Array.isArray(rango) || !Number.isFinite(parametro.valor)) return { accion, detalle: "" };
  const unidad = parametro.unidad;
  const ideal = `lo ideal es de ${numero(rango[0])} a ${numero(rango[1])} ${unidad}`;
  const medido = `${numero(parametro.valor)} ${unidad}`;
  const comoEsta = {
    humedad: `La tierra está en ${medido}`,
    luz: `Le llegan ${medido}`,
    temperatura: `Está a ${medido}`,
  }[parametro.nombre];
  return { accion, detalle: comoEsta ? `${comoEsta}; ${ideal}.` : "" };
}
