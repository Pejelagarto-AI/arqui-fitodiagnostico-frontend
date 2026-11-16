// La mascota del servidor (fase 9 del backend) y la salud de la matera (fase 10) en palabras (F54, F55). Puro: sin
// DOM ni red, probado con `node --test` (tests/mascota-animo.test.mjs). Aquí están las frases por ánimo y por evento,
// la causa, la racha, el «desde hace», el estado del «la regué», la pose que toca (la misma regla que la OLED) y el
// reparto de los avisos en vivo de una planta.
//
// La regla de Santiago: la mascota es el MISMO personaje que la OLED. El dibujo solo usa lo que la OLED tiene
// (saludable, en riesgo, crítica, dormida y el saludo); el ánimo, la vitalidad, la racha y la línea de tiempo van en
// la interfaz alrededor, como texto.

/** El ánimo como lo diría la planta. DORMIDA llega del backend con la noche (si todavía no llega, no pasa nada). */
export const FRASES_DE_ANIMO = Object.freeze({
  FELIZ: "Estoy bien",
  CANSADA: "Estoy cansada",
  SEDIENTA: "Tengo sed",
  AHOGADA: "Estoy ahogada",
  CON_FRIO: "Tengo frío",
  CON_CALOR: "Tengo calor",
  A_OSCURAS: "Está muy oscuro",
  DESLUMBRADA: "Me deslumbra",
  DESMAYADA: "Me desmayé",
  DORMIDA: "Zzz",
  SIN_DATOS: "Todavía no sé cómo estoy",
});

/** El ánimo en una palabra, para la tarjeta del tablero. */
export const PALABRAS_DE_ANIMO = Object.freeze({
  FELIZ: "Feliz",
  CANSADA: "Cansada",
  SEDIENTA: "Sedienta",
  AHOGADA: "Ahogada",
  CON_FRIO: "Friolenta",
  CON_CALOR: "Acalorada",
  A_OSCURAS: "A oscuras",
  DESLUMBRADA: "Deslumbrada",
  DESMAYADA: "Desmayada",
  DORMIDA: "Dormida",
  SIN_DATOS: "Sin datos",
});

export function fraseDeAnimo(animo) {
  return FRASES_DE_ANIMO[animo] || FRASES_DE_ANIMO.SIN_DATOS;
}

export function palabraDeAnimo(animo) {
  return PALABRAS_DE_ANIMO[animo] || PALABRAS_DE_ANIMO.SIN_DATOS;
}

const NOMBRE_DE_PARAMETRO = { humedad: "la humedad de la tierra", luz: "la luz", temperatura: "la temperatura" };
const DIRECCION = { BAJO: "baja", ALTO: "alta" };

/**
 * La causa del ánimo (`causa` de GET .../mascota): «La humedad de la tierra está muy baja». La desviación (fracción
 * del ancho del rango, la del dominio) gradúa: menos de 0,15 es «un poco», 0,5 o más es «muy». Sin causa, null.
 */
export function textoDeCausa(causa) {
  if (!causa || !NOMBRE_DE_PARAMETRO[causa.parametro] || !DIRECCION[causa.direccion]) return null;
  const d = Number(causa.desviacion);
  const cuanto = !Number.isFinite(d) ? "" : d < 0.15 ? "un poco " : d >= 0.5 ? "muy " : "";
  const nombre = NOMBRE_DE_PARAMETRO[causa.parametro];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} está ${cuanto}${DIRECCION[causa.direccion]}`;
}

/** Vitalidad entera de 0 a 100 (llega como número en la consulta y como texto en el aviso en vivo). */
export function vitalidadValida(valor) {
  const n = Number(valor);
  if (valor === null || valor === undefined || valor === "" || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** El color de la barra: los mismos tres del estado (saludable, en riesgo, crítico). */
export function nivelDeVitalidad(vitalidad) {
  if (vitalidad === null) return "SIN_DIAGNOSTICO";
  return vitalidad >= 60 ? "SALUDABLE" : vitalidad >= 30 ? "EN_RIESGO" : "CRITICO";
}

const DIAS_DE_LA_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «hoy», «ayer», «el jueves» (esta semana) o «el 3 de noviembre», en la hora local de quien mira. */
export function diaEnPalabras(iso, ahora = Date.now()) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const inicio = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicio(new Date(ahora)) - inicio(fecha)) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `el ${DIAS_DE_LA_SEMANA[fecha.getDay()]}`;
  return `el ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

/**
 * La racha (bloques de 24 h sin CRITICO, D132 del backend): «3 días sin susto, desde el jueves». En 0 lo dice sin
 * regañar. `desde` puede faltar (el aviso de RACHA solo trae los días).
 */
export function textoDeRacha(racha, ahora = Date.now()) {
  const dias = racha ? Number(racha.dias) || 0 : 0;
  if (dias <= 0) return "Sin racha todavía: cada día sin susto suma uno";
  const cuantos = dias === 1 ? "1 día sin susto" : `${dias} días sin susto`;
  const desde = racha.desde ? diaEnPalabras(racha.desde, ahora) : null;
  return desde ? `${cuantos}, desde ${desde}` : cuantos;
}

/** Los tipos de evento de la línea de tiempo: icono (clave de `iconoDeEvento`) y frase en primera persona. */
export const EVENTOS = Object.freeze({
  REGADA: { icono: "gota", frase: "Me regaron" },
  SALIO_AL_SOL: { icono: "sol", frase: "Salí al sol" },
  DESMAYO: { icono: "desmayo", frase: "Me desmayé" },
  REVIVIO: { icono: "revivio", frase: "Reviví" },
  ACARICIADA: { icono: "corazon", frase: "Me acariciaron" },
  RACHA: { icono: "racha", frase: "Otro día sin susto" },
  RIEGO_DECLARADO: { icono: "reloj", frase: "Dicen que me regaron" },
  RIEGO_CONFIRMADO: { icono: "confirmado", frase: "La tierra confirmó el riego" },
  RIEGO_DESMENTIDO: { icono: "desmentido", frase: "La tierra no notó el riego" },
});

/** Frase de un evento, con lo que aporta su `detalle` (valores de texto). Un tipo nuevo no rompe: «Me pasó algo». */
export function fraseDeEvento(evento) {
  const tipo = evento && evento.tipo;
  const detalle = (evento && evento.detalle) || {};
  if (tipo === "RACHA") {
    const dias = Number(detalle.dias);
    if (dias > 0) return dias === 1 ? "1 día sin susto" : `${dias} días sin susto`;
  }
  if (tipo === "RIEGO_DESMENTIDO") {
    if (detalle.motivo === "SIN_LECTURAS") return "La tierra no notó el riego: no llegaron lecturas";
    if (detalle.motivo === "LA_HUMEDAD_NO_SUBIO") return "La tierra no notó el riego: la humedad no subió";
  }
  return EVENTOS[tipo] ? EVENTOS[tipo].frase : "Me pasó algo";
}

export function iconoDeEventoClave(tipo) {
  return EVENTOS[tipo] ? EVENTOS[tipo].icono : "punto";
}

/** «hace 12 min» (hasta 59) y después «hace 2 h», como D158 del backend. Menos de un minuto cuenta como 1. */
export function textoDesdeHace(iso, ahora = Date.now()) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const minutos = Math.max(1, Math.floor((ahora - t) / 60000));
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h`;
}

const FRASE_DE_SENSOR = { humedad: "no te siento la humedad", luz: "no te siento la luz", temperatura: "no te siento la temperatura" };

/**
 * La frase del aviso de salud (D158 del backend), o null si no hay que avisar (sin salud, OK o un estado raro).
 * FALLA: la frase del servidor tal cual; si no viniera, la misma tabla armada aquí. SIN_NOTICIAS: el «desde hace»
 * se recalcula con `ultimaNoticiaEn` (no se repite el texto que llegó: el tiempo sigue corriendo).
 */
export function fraseDeSalud(salud, ahora = Date.now()) {
  if (!salud) return null;
  if (salud.estado === "SIN_NOTICIAS") {
    const hace = salud.ultimaNoticiaEn ? textoDesdeHace(salud.ultimaNoticiaEn, ahora) : null;
    return hace ? `no sé de la matera desde ${hace}` : salud.mensaje || "no sé de la matera";
  }
  if (salud.estado !== "FALLA") return null;
  if (salud.mensaje) return salud.mensaje;
  const fallan = Object.keys(FRASE_DE_SENSOR).filter((s) => salud.sensores && salud.sensores[s] === "FALLA");
  return fallan.length === 1 ? FRASE_DE_SENSOR[fallan[0]] : "no siento mis sensores";
}

/** ¿Esta salud pide aviso (y mascota preocupada)? */
export function saludEsMala(salud) {
  return Boolean(salud) && (salud.estado === "FALLA" || salud.estado === "SIN_NOTICIAS");
}

const GRAVEDAD_DE_SALUD = { FALLA: 2, SIN_NOTICIAS: 1, OK: 0 };

/**
 * La salud de una planta a partir de sus materas: la peor (FALLA, luego SIN_NOTICIAS), con su serial. Sin ninguna
 * matera que haya dejado noticia, null. Acepta la lista de GET .../dispositivos o un mapa serial -> salud.
 */
export function peorSalud(saludes) {
  let peor = null;
  for (const s of saludes) {
    if (!s || !(s.estado in GRAVEDAD_DE_SALUD)) continue;
    if (!peor || GRAVEDAD_DE_SALUD[s.estado] > GRAVEDAD_DE_SALUD[peor.estado]) peor = s;
  }
  return peor;
}

/** De GET /plantas/{id}/dispositivos a un mapa serial -> salud (con el serial adentro). */
export function saludesDeDispositivos(dispositivos) {
  const mapa = new Map();
  for (const d of dispositivos || []) if (d && d.serial && d.salud) mapa.set(d.serial, { ...d.salud, serial: d.serial });
  return mapa;
}

/** Del aviso en vivo SALUD_DE_LA_MATERA a la misma forma que `salud` de GET .../dispositivos. */
export function saludDesdeAviso(aviso) {
  const d = (aviso && aviso.datos) || {};
  if (!d.serial || !d.estado) return null;
  return {
    serial: d.serial,
    estado: d.estado,
    sensores: { humedad: d.humedad, luz: d.luz, temperatura: d.temperatura },
    cambioEn: d.cambioEn || null,
    ultimaNoticiaEn: d.ultimaNoticiaEn || null,
    mensaje: aviso.mensaje || null,
  };
}

/** «15:42» en la hora local (24 h, como la escribe la gente en Colombia en un letrero). */
export function horaCorta(iso) {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "";
  return `${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
}

/**
 * Estado del «la regué» para pintar debajo del botón: { fase, texto, bloquea }.
 *  - ninguna: sin acción o una vieja ya resuelta hace rato (no se dice nada);
 *  - pendiente: «esperando a que la tierra lo confirme, hasta las 15:42» (el botón no abre otra espera);
 *  - vencida: pendiente pero ya pasó la hora (el servidor la resuelve en su próximo minuto);
 *  - confirmada / desmentida: lo que dijo la tierra.
 */
export function estadoDeRiego(accion, ahora = Date.now()) {
  if (!accion || !accion.estado) return { fase: "ninguna", texto: "", bloquea: false };
  if (accion.estado === "PENDIENTE") {
    const vence = new Date(accion.venceEn).getTime();
    if (Number.isFinite(vence) && ahora > vence) return { fase: "vencida", texto: "La tierra todavía no dice nada; ya casi sabemos", bloquea: true };
    const hora = accion.venceEn ? horaCorta(accion.venceEn) : "";
    return { fase: "pendiente", texto: hora ? `Esperando a que la tierra lo confirme, hasta las ${hora}` : "Esperando a que la tierra lo confirme", bloquea: true };
  }
  if (accion.estado === "CONFIRMADA") return { fase: "confirmada", texto: "La tierra lo confirmó: me regaste. ¡Gracias!", bloquea: false };
  if (accion.estado === "DESMENTIDA") {
    const texto = accion.motivo === "SIN_LECTURAS" ? "No llegaron lecturas para confirmarlo. Si la regaste, ya se notará" : "La tierra no lo notó: la humedad no subió";
    return { fase: "desmentida", texto, bloquea: false };
  }
  return { fase: "ninguna", texto: "", bloquea: false };
}

/** De un evento RIEGO_* (consulta o aviso) a la acción que describe; null si el evento no es de riego. */
export function accionDesdeEvento(tipo, detalle = {}, ocurridoEn = null) {
  if (tipo === "RIEGO_DECLARADO") return { id: detalle.accionId || null, estado: "PENDIENTE", venceEn: detalle.venceEn || null };
  if (tipo === "RIEGO_CONFIRMADO") return { id: detalle.accionId || null, estado: "CONFIRMADA", resueltaEn: ocurridoEn };
  if (tipo === "RIEGO_DESMENTIDO") return { id: detalle.accionId || null, estado: "DESMENTIDA", motivo: detalle.motivo || null, resueltaEn: ocurridoEn };
  return null;
}

/**
 * La pose del dibujo: { estado, periodo } para `crearMascotaVista.aplicar`. Parte del estado y el periodo del
 * diagnóstico vigente (como la OLED) y solo se mueve a poses que la OLED tiene:
 *  - DESMAYADA: la pose crítica (vitalidad en 0);
 *  - DORMIDA: dormida (periodo NOCHE), aunque el diagnóstico no traiga el periodo;
 *  - salud mala (sensor que falla o matera callada): al menos en riesgo, la cara preocupada (`nivelVisible()` del
 *    firmware, max(nivel, 1)).
 */
export function poseDeMascota({ estado = null, periodo = null, animo = null, saludMala = false } = {}) {
  let e = estado;
  let p = periodo;
  if (animo === "DESMAYADA") e = "CRITICO";
  if (animo === "DORMIDA") p = "NOCHE";
  if (saludMala && (e === null || e === "SALUDABLE")) e = "EN_RIESGO";
  return { estado: e, periodo: p };
}

/** Qué hace el dibujo cuando llega un evento: "regar" | "saludar" | null (los de pose los resuelve el ánimo). */
export function animacionDeEvento(tipo) {
  if (tipo === "REGADA") return "regar";
  if (tipo === "ACARICIADA" || tipo === "RIEGO_CONFIRMADO") return "saludar";
  return null;
}

/** El motivo de un aviso CAMBIO_DE_ESTADO, venga arriba o dentro de `datos` (el backend lo está agregando). */
export function motivoDeAviso(aviso) {
  if (!aviso) return null;
  return aviso.motivo || (aviso.datos && aviso.datos.motivo) || null;
}

/** El cambio de estado por la noche (`motivo: PERIODO`) no merece toast: solo se actualiza la pantalla. */
export function debeAvisarCambioDeEstado(aviso) {
  return motivoDeAviso(aviso) !== "PERIODO";
}

/**
 * Qué hacer con la respuesta de ACARICIAR. 201: evento nuevo (entra a la línea de tiempo si el aviso en vivo no lo
 * trajo ya). 200: el backend lo tomó como repetido (otra caricia dentro de 10 s): sin evento ni animación extra; el
 * saludo local ya se vio. Cualquier otra cosa se trata como 200.
 */
export function caricia(respuesta) {
  return respuesta && respuesta.status === 201 && respuesta.cuerpo && respuesta.cuerpo.id ? { nueva: true, id: respuesta.cuerpo.id, en: respuesta.cuerpo.creadaEn || null } : { nueva: false };
}

/**
 * El oyente de los avisos en vivo de UNA planta (`/user/queue/plantas/{id}`): reparte por `tipo` a `manejadores`
 * (EVENTO_DE_MASCOTA, SALUD_DE_LA_MATERA, CAMBIO_DE_ESTADO, DIAGNOSTICO_NUEVO...) e ignora lo que traiga otra
 * `plantaId` o un tipo sin manejador.
 */
export function crearOyenteDePlanta(plantaId, manejadores) {
  return (mensaje) => {
    if (!mensaje || typeof mensaje.tipo !== "string") return false;
    const id = mensaje.datos && mensaje.datos.plantaId;
    if (id && id !== plantaId) return false;
    const manejar = manejadores[mensaje.tipo];
    if (!manejar) return false;
    manejar(mensaje);
    return true;
  };
}

/**
 * Suscribe UNA vez por planta abierta, con la función `suscribir(destino, oyente)` de envivo.js inyectada (así se
 * prueba sin WebSocket). Devuelve la baja.
 */
export function suscribirAPlanta(suscribir, destinoDePlanta, plantaId, manejadores) {
  return suscribir(destinoDePlanta(plantaId), crearOyenteDePlanta(plantaId, manejadores));
}

/** Evento de la línea de tiempo a partir del aviso EVENTO_DE_MASCOTA (misma forma que GET .../eventos). */
export function eventoDesdeAviso(aviso) {
  const d = (aviso && aviso.datos) || {};
  if (!d.evento) return null;
  return { id: d.eventoId || null, tipo: d.evento, ocurridoEn: d.ocurridoEn || null, detalle: aviso.detalle || {} };
}

/** Junta eventos nuevos con los que ya hay, sin repetir id, del más reciente al más antiguo. */
export function juntarEventos(actuales, nuevos) {
  const vistos = new Set();
  const todos = [];
  for (const e of [...nuevos, ...actuales]) {
    if (!e) continue;
    const clave = e.id || `${e.tipo}@${e.ocurridoEn}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    todos.push(e);
  }
  return todos.sort((a, b) => new Date(b.ocurridoEn || 0) - new Date(a.ocurridoEn || 0));
}
