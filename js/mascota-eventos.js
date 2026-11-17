// La cola de eventos de la mascota y los tiempos de sus animaciones, calcados de `firmware/src/nucleo/fito_mascota.{h,c}`
// (fase 14 del backend, D190 a D199): los mismos nombres, los mismos milisegundos y la misma regla. La OLED reproduce
// los eventos de a uno, en orden, cada uno ocupa un turno fijo de FRASE_EVENTO_MS (la animación más larga, 1800 ms, cabe
// adentro) y, mientras no suena ninguno, la fila de abajo alterna cada FRASE_ALTERNA_MS entre el estado y la frase del
// ánimo. Puro: sin DOM ni red, probado con `node --test` (tests/mascota-eventos.test.mjs, con los mismos guiones a
// mano y el mismo modelo al azar que `firmware/test/probar_nucleo.py`). Si cambia un número en fito_mascota.h, cambia aquí.

/** Orden de `animo` en frases.h (frases.json). */
export const ANIMOS = Object.freeze(["FELIZ", "CANSADA", "SEDIENTA", "AHOGADA", "CON_FRIO", "CON_CALOR", "A_OSCURAS", "DESLUMBRADA", "DESMAYADA", "DORMIDA", "SIN_DATOS"]);
/** Orden de `accesorio` (FITO_ACC_*). */
export const ACCESORIOS = Object.freeze(["NINGUNO", "SOMBRERO", "MONO", "GAFAS"]);
/** Orden de `evento` (FITO_EV_*). RIEGO_DECLARADO no tiene frase ni turno: la OLED lo ignora (D192). */
export const EVENTOS_DE_MASCOTA = Object.freeze(["REGADA", "SALIO_AL_SOL", "DESMAYO", "REVIVIO", "ACARICIADA", "RACHA", "RIEGO_DECLARADO", "RIEGO_CONFIRMADO", "RIEGO_DESMENTIDO"]);

export const FRASE_ALTERNA_MS = 3000; // FITO_FRASE_ALTERNA_MS: sin evento, la fila alterna estado / frase del ánimo
export const FRASE_EVENTO_MS = 3000; // FITO_FRASE_EVENTO_MS: la frase de un evento y el turno de cada uno en la cola
export const COLA_EV_MAX = 10; // FITO_COLA_EV_MAX: eventos que pueden esperar

export const FILA_ESTADO = 0;
export const FILA_ANIMO = 1; // FITO_FRASE_ANIMO
export const FILA_EVENTO = 2; // FITO_FRASE_EVENTO

/** Efectos de la esquina de arriba a la derecha: ms por cuadro, cuadros por vuelta y vueltas (FITO_*_CUADRO_MS, _CUADROS, _VUELTAS). */
export const RAYOS = Object.freeze({ CUADRO_MS: 250, CUADROS: 3, VUELTAS: 2 }); // SALIO_AL_SOL, 1500 ms
export const CORAZON = Object.freeze({ CUADRO_MS: 300, CUADROS: 2, VUELTAS: 3 }); // ACARICIADA, 1800 ms más el saludo
export const DESTELLOS = Object.freeze({ CUADRO_MS: 200, CUADROS: 3, VUELTAS: 2 }); // REVIVIO, 1200 ms más el saludo
export const ESTRELLA = Object.freeze({ CUADRO_MS: 300, CUADROS: 3, VUELTAS: 2 }); // RACHA, 1800 ms
export const DESMAYO_CUADRO_MS = 100; // FITO_DESMAYO_CUADRO_MS
export const DESMAYO_DY = Object.freeze([0, 0, 1, 1, 2, 2]); // FITO_DESMAYO_DY: el cuerpo baja en 600 ms
export const DESMAYO_MS = DESMAYO_CUADRO_MS * DESMAYO_DY.length;
export const DESMAYADA_DY = 2; // FITO_DESMAYADA_DY: queda 2 px abajo mientras el ánimo sea DESMAYADA

const duracion = (e) => e.CUADRO_MS * e.CUADROS * e.VUELTAS;
export const RAYOS_MS = duracion(RAYOS);
export const CORAZON_MS = duracion(CORAZON);
export const DESTELLOS_MS = duracion(DESTELLOS);
export const ESTRELLA_MS = duracion(ESTRELLA);

/** Qué efecto de la esquina lleva cada evento (el nombre de la tabla de arriba y del sprite en `arte/`). */
export const EFECTO_DE_EVENTO = Object.freeze({ SALIO_AL_SOL: "rayos", ACARICIADA: "corazon", REVIVIO: "destellos", RACHA: "estrella" });
const TABLA_DE_EFECTO = { rayos: RAYOS, corazon: CORAZON, destellos: DESTELLOS, estrella: ESTRELLA };

/** `fito_ev_animacion_ms`: cuánto dura la parte animada de un evento (0 = solo frase). De noche la mascota se despierta ese tiempo. */
export function animacionMs(tipo) {
  switch (tipo) {
    case "SALIO_AL_SOL": return RAYOS_MS;
    case "ACARICIADA": return CORAZON_MS;
    case "REVIVIO": return DESTELLOS_MS;
    case "RACHA": return ESTRELLA_MS;
    case "DESMAYO": return DESMAYO_MS;
    default: return 0;
  }
}

/** ¿El evento arranca el saludo de la fase 11 al empezar su turno? (ACARICIADA y REVIVIO, D196.) */
export const haceSaludo = (tipo) => tipo === "ACARICIADA" || tipo === "REVIVIO";

/** `fito_cuadro_ciclico`: cuadro de una animación cíclica a `t` ms de empezada (0..cuadros-1), o -1 si ya terminó. */
export function cuadroCiclico(t, cuadroMs, cuadros, vueltas) {
  if (!(t >= 0) || t >= cuadroMs * cuadros * vueltas) return -1;
  return Math.floor(t / cuadroMs) % cuadros;
}

/** { efecto, cuadro } del efecto de un evento a `t` ms de empezado; null si no lleva efecto o ya terminó. */
export function efectoDe(tipo, t) {
  const efecto = EFECTO_DE_EVENTO[tipo];
  if (!efecto) return null;
  const e = TABLA_DE_EFECTO[efecto];
  const cuadro = cuadroCiclico(t, e.CUADRO_MS, e.CUADROS, e.VUELTAS);
  return cuadro < 0 ? null : { efecto, cuadro };
}

/** `fito_desmayo_dy`: px que baja el cuerpo `t` ms después de empezado DESMAYO (0 al principio, DESMAYADA_DY al final y después). */
export function desmayoDy(t) {
  return t >= DESMAYO_MS ? DESMAYADA_DY : DESMAYO_DY[Math.floor(Math.max(0, t) / DESMAYO_CUADRO_MS)];
}

/** `fito_barra_px`: px rellenos de `ancho` para una vitalidad de 0 a 100 (se recorta fuera de rango). */
export function barraPx(vitalidad, ancho) {
  const v = Math.max(0, Math.min(100, vitalidad));
  return Math.floor((v * ancho + 50) / 100);
}

// ---------- la cola ----------

const u32 = (n) => n >>> 0; // `uint32_t` de C: el reloj de la placa da la vuelta, la resta tiene que seguir dando bien

/**
 * `fito_cola_ev`: un anillo de COLA_EV_MAX con el evento que suena. `ahora` en ms (cualquier reloj monótono; se toma
 * como uint32 como en la placa). Devuelve { empujar(tipo), avanzar(ahora), fila(ahora, hayAnimo), descartados, esperando }.
 */
export function crearCola(ahora = 0) {
  const espera = [];
  let activo = null; // tipo que suena
  let desde = 0;
  let ciclo = u32(ahora); // dónde empieza el ciclo estado / frase (al terminar el último evento)
  let descartados = 0;
  let turno = 0; // cuántos han arrancado (para que quien mire sepa que empezó uno nuevo)
  return {
    /**
     * `fito_ev_empujar`. true = aceptado. false = ignorado: un tipo que no se conoce, o RIEGO_DECLARADO. Con la cola llena se
     * pierde el más antiguo de los que esperan (el que está sonando no se corta) y se cuenta en `descartados`.
     */
    empujar(tipo) {
      if (!EVENTOS_DE_MASCOTA.includes(tipo) || tipo === "RIEGO_DECLARADO") return false;
      if (espera.length === COLA_EV_MAX) {
        espera.shift();
        descartados += 1;
      }
      espera.push(tipo);
      return true;
    },
    /**
     * `fito_ev_avanzar`: termina el evento que cumplió FRASE_EVENTO_MS y arranca el siguiente en ese mismo instante (no
     * recupera el tiempo que perdió un bucle lento). Si suena uno: { tipo, t, turno } con `t` los ms desde que empezó.
     */
    avanzar(ahoraMs) {
      const a = u32(ahoraMs);
      if (activo !== null && u32(a - desde) >= FRASE_EVENTO_MS) {
        activo = null;
        ciclo = a;
      }
      if (activo === null && espera.length > 0) {
        activo = espera.shift();
        desde = a;
        turno += 1;
      }
      return activo === null ? null : { tipo: activo, t: u32(a - desde), turno };
    },
    /** `fito_fila`: FILA_EVENTO si suena uno; si no, alterna FILA_ESTADO (los primeros 3 s del ciclo) y FILA_ANIMO. Sin ánimo, siempre el estado. */
    fila(ahoraMs, hayAnimo) {
      if (activo !== null) return FILA_EVENTO;
      if (!hayAnimo) return FILA_ESTADO;
      return Math.floor(u32(u32(ahoraMs) - ciclo) / FRASE_ALTERNA_MS) % 2 ? FILA_ANIMO : FILA_ESTADO;
    },
    get descartados() { return descartados; },
    get esperando() { return espera.length; },
    get sonando() { return activo; },
  };
}

/**
 * La cola con su reloj de pared, para compartirla entre lo que la dibuja (las mascotas) y lo que la dice (el globo y el
 * texto de estado): todos la avanzan con el mismo reloj y avanzar dos veces en el mismo instante no cambia nada.
 * `reloj` se inyecta para probar sin esperar. `avanzar()` devuelve { tipo, t, turno } o null.
 */
export function crearReproductor({ reloj = () => performance.now() } = {}) {
  const cola = crearCola(reloj());
  return {
    empujar: (tipo) => cola.empujar(tipo),
    avanzar: (ahora = reloj()) => cola.avanzar(ahora),
    fila: (hayAnimo, ahora = reloj()) => cola.fila(ahora, hayAnimo),
    reloj,
    cola,
  };
}

/**
 * Qué caricias son las propias. El firmware repite la animación cuando su propia caricia vuelve como evento (D198: «la
 * matera no distingue la suya de la de la app»); aquí sí se distingue: la caricia local ya animó al tocar, así que el
 * evento ACARICIADA que vuelve por el aviso en vivo con el mismo `eventoId` (el de la respuesta 201) no anima otra vez.
 * El aviso puede llegar ANTES que la respuesta: mientras hay una caricia en vuelo, un ACARICIADA de persona sin id
 * conocido es el eco de ella (el servidor tiene un enfriamiento de 10 s por planta: no hay otra que pueda llegar en ese
 * lapso). Uno de la matera nunca es eco.
 */
export function crearRegistroDeCaricias() {
  const propias = new Set();
  let enVuelo = 0;
  return {
    /** Se tocó: sale la petición. */
    empezar() { enVuelo += 1; },
    /** Respondió: `id` es el del 201 (null si fue 200 repetida o falló). */
    terminar(id = null) {
      enVuelo = Math.max(0, enVuelo - 1);
      if (id) propias.add(id);
    },
    /** ¿Este aviso ACARICIADA (eventoId, origen PERSONA o MATERA) es el eco de una caricia propia? */
    esEco(id, origen) {
      if (id && propias.has(id)) return true;
      if (origen === "MATERA" || enVuelo === 0) return false;
      if (id) propias.add(id);
      return true;
    },
  };
}
