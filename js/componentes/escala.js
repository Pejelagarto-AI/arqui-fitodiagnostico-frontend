// Cálculos puros de la presentación del diagnóstico (sin DOM ni red): se prueban con Node.
// Qué tan lejos está un valor de su rango óptimo, la serie de últimas lecturas por parámetro y
// qué recomendación corresponde a cuál parámetro.

// Escala física de cada magnitud: la barra no empieza en el mínimo del rango, empieza en cero
// (o donde caiga el valor) para que «lejos del óptimo» se vea como distancia real.
const ESCALA_BASE = {
  humedad: [0, 100],
  luz: [0, 2000],
  temperatura: [0, 40],
};

/** Límites [mínimo, máximo] de la barra: la base, ensanchada si el rango o el valor se salen de ella. */
export function escalaDe(nombre, rangoOptimo, valor) {
  const [baseMin, baseMax] = ESCALA_BASE[nombre] || [0, 100];
  const candidatos = [...rangoOptimo, valor].filter(Number.isFinite);
  return [Math.min(baseMin, ...candidatos), Math.max(baseMax, ...candidatos)];
}

/** Posición de `valor` en `[min, max]` como porcentaje, acotada a 0..100. */
export function porcentaje(valor, [min, max]) {
  if (!(max > min) || !Number.isFinite(valor)) return 0;
  return Math.max(0, Math.min(100, ((valor - min) / (max - min)) * 100));
}

/** Quita los ceros inútiles de un número para mostrarlo (40, 7.5). */
export function numeroLegible(n) {
  return String(Number(Number(n).toFixed(1)));
}

/**
 * Valores del parámetro en orden cronológico (el más viejo primero) a partir de una página del
 * historial, que llega con el más reciente primero. Se queda con las últimas `maximo` lecturas.
 */
export function serieDeParametro(registros, nombre, maximo = 8) {
  const valores = [];
  for (const registro of registros || []) {
    const p = registro.diagnostico && registro.diagnostico.parametros.find((x) => x.nombre === nombre);
    if (p && Number.isFinite(p.valor)) valores.push(p.valor);
    if (valores.length === maximo) break;
  }
  return valores.reverse();
}

/**
 * El backend redacta UNA recomendación por cada parámetro fuera de rango, en el orden de los
 * parámetros (RedactorDeRecomendaciones). Con eso se asocia cada texto a su parámetro; si las
 * cuentas no coinciden no se adivina y los textos quedan sin parámetro.
 */
export function recomendacionesPorParametro(parametros, recomendaciones) {
  const fuera = parametros.filter((p) => p.estado !== "OPTIMO");
  const coincide = fuera.length === recomendaciones.length;
  return recomendaciones.map((texto, i) => ({ texto, parametro: coincide ? fuera[i].nombre : null }));
}
