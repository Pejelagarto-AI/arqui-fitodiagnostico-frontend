// F54, F55: la mascota del servidor y la salud de la matera en palabras (js/mascota-animo.js), sin DOM ni red.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as A from "../js/mascota-animo.js";

const MIN = 60000;
// Fechas locales: así «el jueves» no depende de la zona horaria de quien corre la prueba.
const ahora = new Date(2026, 10, 16, 15, 30).getTime(); // lunes 16 de noviembre de 2026, 3:30 p. m.

test("frase en primera persona por cada ánimo del backend, DORMIDA incluida; uno desconocido no rompe", () => {
  const esperadas = {
    FELIZ: "Estoy bien", CANSADA: "Estoy cansada", SEDIENTA: "Tengo sed", AHOGADA: "Estoy ahogada", CON_FRIO: "Tengo frío",
    CON_CALOR: "Tengo calor", A_OSCURAS: "Está muy oscuro", DESLUMBRADA: "Me deslumbra", DESMAYADA: "Me desmayé",
    DORMIDA: "Zzz", SIN_DATOS: "Todavía no sé cómo estoy",
  };
  for (const [animo, frase] of Object.entries(esperadas)) assert.equal(A.fraseDeAnimo(animo), frase, animo);
  assert.equal(A.fraseDeAnimo("ALGO_NUEVO"), "Todavía no sé cómo estoy");
  assert.equal(A.fraseDeAnimo(null), "Todavía no sé cómo estoy");
  for (const animo of Object.keys(esperadas)) assert.ok(A.palabraDeAnimo(animo).length <= 12, `${animo}: corta para la tarjeta`);
  assert.equal(A.palabraDeAnimo("SEDIENTA"), "Sedienta");
});

test("la causa dice parámetro y dirección, graduada por la desviación; sin causa (DORMIDA, FELIZ) no dice nada", () => {
  assert.equal(A.textoDeCausa({ parametro: "humedad", direccion: "BAJO", desviacion: 0.27 }), "La humedad de la tierra está baja");
  assert.equal(A.textoDeCausa({ parametro: "luz", direccion: "ALTO", desviacion: 0.1 }), "La luz está un poco alta");
  assert.equal(A.textoDeCausa({ parametro: "temperatura", direccion: "BAJO", desviacion: 0.8 }), "La temperatura está muy baja");
  assert.equal(A.textoDeCausa(null), null);
  assert.equal(A.textoDeCausa({ parametro: "gas", direccion: "BAJO" }), null);
});

test("vitalidad: número o texto (aviso en vivo) a entero de 0 a 100, y su color", () => {
  assert.equal(A.vitalidadValida("64"), 64);
  assert.equal(A.vitalidadValida(64.6), 65);
  assert.equal(A.vitalidadValida(130), 100);
  assert.equal(A.vitalidadValida(null), null);
  assert.equal(A.vitalidadValida("x"), null);
  assert.equal(A.nivelDeVitalidad(80), "SALUDABLE");
  assert.equal(A.nivelDeVitalidad(45), "EN_RIESGO");
  assert.equal(A.nivelDeVitalidad(0), "CRITICO");
  assert.equal(A.nivelDeVitalidad(null), "SIN_DIAGNOSTICO");
});

test("racha: «3 días sin susto, desde el jueves», ayer, hoy, una fecha vieja y sin racha", () => {
  const jueves = new Date(2026, 10, 12, 7, 41).toISOString();
  assert.equal(A.textoDeRacha({ dias: 3, desde: jueves }, ahora), "3 días sin susto, desde el jueves");
  assert.equal(A.textoDeRacha({ dias: 1, desde: new Date(2026, 10, 15, 9).toISOString() }, ahora), "1 día sin susto, desde ayer");
  assert.equal(A.textoDeRacha({ dias: 12, desde: new Date(2026, 10, 3, 9).toISOString() }, ahora), "12 días sin susto, desde el 3 de noviembre");
  assert.equal(A.textoDeRacha({ dias: 2 }, ahora), "2 días sin susto");
  assert.equal(A.textoDeRacha({ dias: 0, desde: null }, ahora), "Sin racha todavía: cada día sin susto suma uno");
  assert.equal(A.textoDeRacha(null, ahora), "Sin racha todavía: cada día sin susto suma uno");
});

test("frase e icono por cada tipo de evento, con lo que aporta el detalle", () => {
  const tipos = ["REGADA", "SALIO_AL_SOL", "DESMAYO", "REVIVIO", "ACARICIADA", "RACHA", "RIEGO_DECLARADO", "RIEGO_CONFIRMADO", "RIEGO_DESMENTIDO"];
  const iconos = new Set();
  for (const tipo of tipos) {
    assert.notEqual(A.fraseDeEvento({ tipo, detalle: {} }), "Me pasó algo", tipo);
    iconos.add(A.iconoDeEventoClave(tipo));
  }
  assert.equal(iconos.size, tipos.length, "cada tipo tiene su icono");
  assert.equal(A.fraseDeEvento({ tipo: "REGADA", detalle: {} }), "Me regaron");
  assert.equal(A.fraseDeEvento({ tipo: "ACARICIADA", detalle: {} }), "Me acariciaron");
  assert.equal(A.fraseDeEvento({ tipo: "RACHA", detalle: { dias: "3" } }), "3 días sin susto");
  assert.equal(A.fraseDeEvento({ tipo: "RIEGO_DESMENTIDO", detalle: { motivo: "SIN_LECTURAS" } }), "La tierra no notó el riego: no llegaron lecturas");
  assert.equal(A.fraseDeEvento({ tipo: "RIEGO_DESMENTIDO", detalle: { motivo: "LA_HUMEDAD_NO_SUBIO" } }), "La tierra no notó el riego: la humedad no subió");
  assert.equal(A.fraseDeEvento({ tipo: "NUEVO" }), "Me pasó algo");
  assert.equal(A.iconoDeEventoClave("NUEVO"), "punto");
});

test("«desde hace»: minutos hasta 59, después horas; menos de un minuto cuenta como 1", () => {
  const hace = (ms) => new Date(ahora - ms).toISOString();
  assert.equal(A.textoDesdeHace(hace(12 * MIN + 30000), ahora), "hace 12 min");
  assert.equal(A.textoDesdeHace(hace(20000), ahora), "hace 1 min");
  assert.equal(A.textoDesdeHace(hace(59 * MIN), ahora), "hace 59 min");
  assert.equal(A.textoDesdeHace(hace(60 * MIN), ahora), "hace 1 h");
  assert.equal(A.textoDesdeHace(hace(150 * MIN), ahora), "hace 2 h");
  assert.equal(A.textoDesdeHace("no es fecha", ahora), null);
});

test("salud: la frase exacta del backend en FALLA, «desde hace» recalculado en SIN_NOTICIAS y nada con OK", () => {
  const falla = { estado: "FALLA", sensores: { humedad: "OK", luz: "OK", temperatura: "FALLA" }, mensaje: "no te siento la temperatura" };
  assert.equal(A.fraseDeSalud(falla, ahora), "no te siento la temperatura");
  assert.equal(A.fraseDeSalud({ ...falla, mensaje: null }, ahora), "no te siento la temperatura");
  assert.equal(A.fraseDeSalud({ estado: "FALLA", sensores: { humedad: "FALLA", luz: "OK", temperatura: "OK" } }, ahora), "no te siento la humedad");
  assert.equal(A.fraseDeSalud({ estado: "FALLA", sensores: { humedad: "FALLA", luz: "FALLA", temperatura: "OK" } }, ahora), "no siento mis sensores");
  const callada = { estado: "SIN_NOTICIAS", ultimaNoticiaEn: new Date(ahora - 12 * MIN).toISOString(), mensaje: "no sé de la matera desde hace 2 min" };
  assert.equal(A.fraseDeSalud(callada, ahora), "no sé de la matera desde hace 12 min", "no se repite el texto que llegó");
  assert.equal(A.fraseDeSalud(callada, ahora + 60 * MIN), "no sé de la matera desde hace 1 h");
  assert.equal(A.fraseDeSalud({ estado: "OK", mensaje: "todos mis sensores responden" }, ahora), null);
  assert.equal(A.fraseDeSalud(null, ahora), null);
  assert.equal(A.saludEsMala(falla), true);
  assert.equal(A.saludEsMala({ estado: "OK" }), false);
  assert.equal(A.saludEsMala(null), false);
});

test("salud de varias materas: gana la peor; el aviso en vivo se lee igual que la consulta", () => {
  const lista = [
    { serial: "fito-AAAAAA", salud: { estado: "OK" } },
    { serial: "fito-BBBBBB", salud: { estado: "SIN_NOTICIAS", ultimaNoticiaEn: "2026-11-16T14:00:00Z" } },
    { serial: "fito-CCCCCC", salud: null },
  ];
  const mapa = A.saludesDeDispositivos(lista);
  assert.equal(mapa.size, 2);
  assert.equal(A.peorSalud(mapa.values()).serial, "fito-BBBBBB");
  mapa.set("fito-AAAAAA", { estado: "FALLA", serial: "fito-AAAAAA" });
  assert.equal(A.peorSalud(mapa.values()).estado, "FALLA");
  assert.equal(A.peorSalud([]), null);
  const aviso = {
    tipo: "SALUD_DE_LA_MATERA", mensaje: "no te siento la temperatura",
    datos: { plantaId: "p", serial: "fito-YUBUD6", estado: "FALLA", humedad: "OK", luz: "OK", temperatura: "FALLA", ultimaNoticiaEn: "2026-11-16T14:12:45Z" },
  };
  const salud = A.saludDesdeAviso(aviso);
  assert.equal(salud.serial, "fito-YUBUD6");
  assert.equal(salud.sensores.temperatura, "FALLA");
  assert.equal(A.fraseDeSalud(salud, ahora), "no te siento la temperatura");
  assert.equal(A.saludDesdeAviso({ datos: {} }), null);
});

test("«la regué»: pendiente con la hora límite, vencida, confirmada y desmentida; el botón no abre otra espera", () => {
  const venceEn = new Date(2026, 10, 16, 15, 42).toISOString();
  const pendiente = A.estadoDeRiego({ estado: "PENDIENTE", venceEn }, ahora);
  assert.equal(pendiente.fase, "pendiente");
  assert.equal(pendiente.texto, "Esperando a que la tierra lo confirme, hasta las 15:42");
  assert.equal(pendiente.bloquea, true);
  assert.equal(A.estadoDeRiego({ estado: "PENDIENTE", venceEn }, ahora + 13 * MIN).fase, "vencida");
  assert.equal(A.estadoDeRiego({ estado: "CONFIRMADA" }, ahora).fase, "confirmada");
  assert.equal(A.estadoDeRiego({ estado: "CONFIRMADA" }, ahora).bloquea, false);
  assert.match(A.estadoDeRiego({ estado: "DESMENTIDA", motivo: "LA_HUMEDAD_NO_SUBIO" }, ahora).texto, /no subió/);
  assert.match(A.estadoDeRiego({ estado: "DESMENTIDA", motivo: "SIN_LECTURAS" }, ahora).texto, /No llegaron lecturas/);
  assert.deepEqual(A.estadoDeRiego(null, ahora), { fase: "ninguna", texto: "", bloquea: false });
  assert.equal(A.horaCorta(new Date(2026, 10, 16, 9, 5).toISOString()), "09:05");
  // los eventos de riego se vuelven acciones
  assert.equal(A.accionDesdeEvento("RIEGO_DECLARADO", { accionId: "a", venceEn }).estado, "PENDIENTE");
  assert.equal(A.accionDesdeEvento("RIEGO_CONFIRMADO", { accionId: "a" }).estado, "CONFIRMADA");
  assert.equal(A.accionDesdeEvento("RIEGO_DESMENTIDO", { motivo: "SIN_LECTURAS" }).motivo, "SIN_LECTURAS");
  assert.equal(A.accionDesdeEvento("REGADA", {}), null);
});

test("pose: solo las de la OLED (desmayada = su pose, dormida = noche, salud mala = al menos en riesgo)", () => {
  assert.deepEqual(A.poseDeMascota({ estado: "SALUDABLE", periodo: "DIA", animo: "FELIZ" }), { estado: "SALUDABLE", periodo: "DIA", desmayada: false });
  // F56 (D194): DESMAYADA ya no se disfraza de crítica: el estado queda y la mascota pone su pose (ojos en «x», 2 px abajo)
  assert.deepEqual(A.poseDeMascota({ estado: "EN_RIESGO", animo: "DESMAYADA" }), { estado: "EN_RIESGO", periodo: null, desmayada: true });
  assert.deepEqual(A.poseDeMascota({ estado: "SALUDABLE", periodo: "DIA", animo: "DORMIDA" }), { estado: "SALUDABLE", periodo: "NOCHE", desmayada: false });
  assert.equal(A.poseDeMascota({ estado: "SALUDABLE", saludMala: true }).estado, "EN_RIESGO");
  assert.equal(A.poseDeMascota({ estado: null, saludMala: true }).estado, "EN_RIESGO");
  assert.equal(A.poseDeMascota({ estado: "CRITICO", saludMala: true }).estado, "CRITICO", "nunca mejora la cara");
  // sin ánimo DORMIDA (backend viejo) la noche sale del periodo del diagnóstico, como en F49
  assert.equal(A.poseDeMascota({ estado: "SALUDABLE", periodo: "NOCHE", animo: "A_OSCURAS" }).periodo, "NOCHE");
});

test("la mascota habla con la personalidad de su familia (la tabla de la OLED); el ánimo nuevo cae en la frase genérica", () => {
  assert.equal(A.fraseDeLaMascota("girasol", "SEDIENTA"), "agua, porfa!");
  assert.equal(A.fraseDeLaMascota("cactus", "SEDIENTA"), "una gotica va");
  assert.equal(A.fraseDeLaMascota("generica", "FELIZ"), "estoy bien");
  assert.equal(A.fraseDeLaMascota("especie-rara", "FELIZ"), A.fraseDeLaMascota("generica", "FELIZ"), "la especie sin mascota usa generica");
  assert.equal(A.fraseDeLaMascota("girasol", "VOLANDO"), "Todavía no sé cómo estoy", "ánimo nuevo: la frase larga de siempre");
  assert.equal(A.fraseDeEventoDeLaMascota("girasol", "ACARICIADA"), "jiji");
  assert.equal(A.fraseDeEventoDeLaMascota("girasol", "RIEGO_DECLARADO"), null);
  // para la línea de tiempo y los toasts siguen las frases largas
  assert.equal(A.fraseDeAnimo("FELIZ"), "Estoy bien");
  assert.equal(A.fraseDeEvento({ tipo: "ACARICIADA", detalle: {} }), "Me acariciaron");
});

test("la fila de abajo de la OLED en la tarjeta grande: estado, frase del ánimo y frase del evento, y cuándo cuenta como frase", () => {
  const base = { familia: "cactus", animo: "SEDIENTA", estado: "EN_RIESGO" };
  assert.deepEqual(A.textoDeFila({ ...base, fila: 0 }), { texto: "En riesgo", esFrase: false });
  assert.deepEqual(A.textoDeFila({ ...base, fila: 1 }), { texto: "una gotica va", esFrase: true });
  assert.deepEqual(A.textoDeFila({ ...base, fila: 2, tipoDeEvento: "ACARICIADA" }), { texto: "ojo, pincho", esFrase: true });
  assert.deepEqual(A.textoDeFila({ ...base, estado: null, fila: 0 }), { texto: "Sin lecturas", esFrase: false });
  assert.equal(A.textoDeFila({ ...base, estado: "CRITICO", fila: 0 }).texto, "Crítico");
  // un ánimo nuevo no tiene frase: la fila se queda en el estado (D192)
  assert.deepEqual(A.textoDeFila({ ...base, animo: "VOLANDO", fila: 1 }), { texto: "En riesgo", esFrase: false });
  assert.equal(A.hayFraseDeAnimo("cactus", "VOLANDO"), false);
  assert.equal(A.hayFraseDeAnimo("cactus", "FELIZ"), true);
  assert.deepEqual(A.textoDeFila({ ...base, fila: 2, tipoDeEvento: "RIEGO_DECLARADO" }), { texto: "En riesgo", esFrase: false });
});

test("una caricia de la matera dice la frase de la familia y «(desde la matera)»; la de la app, la de siempre", () => {
  const deMatera = { tipo: "ACARICIADA", detalle: { origen: "MATERA" } };
  assert.equal(A.fraseDeEvento(deMatera, "girasol"), "jiji (desde la matera)");
  assert.equal(A.fraseDeEvento(deMatera, "cactus"), "ojo, pincho (desde la matera)");
  assert.equal(A.fraseDeEvento(deMatera), `${A.fraseDeEventoDeLaMascota("generica", "ACARICIADA")} (desde la matera)`, "sin familia, la genérica");
  assert.equal(A.fraseDeEvento({ tipo: "ACARICIADA", detalle: { origen: "PERSONA" } }, "girasol"), "Me acariciaron");
  assert.equal(A.fraseDeEvento({ tipo: "REGADA", detalle: { origen: "MATERA" } }, "girasol"), "Me regaron", "solo la caricia lleva origen");
  // el aviso en vivo trae el origen en `datos` y se junta al detalle, como lo trae la consulta
  const evento = A.eventoDesdeAviso({ tipo: "EVENTO_DE_MASCOTA", datos: { evento: "ACARICIADA", eventoId: "e1", origen: "MATERA", ocurridoEn: "2026-11-16T15:00:00Z" }, detalle: {} });
  assert.deepEqual(evento.detalle, { origen: "MATERA" });
  assert.equal(A.fraseDeEvento(evento, "suculenta"), `${A.fraseDeEventoDeLaMascota("suculenta", "ACARICIADA")} (desde la matera)`);
  assert.deepEqual(A.eventoDesdeAviso({ datos: { evento: "RACHA", eventoId: "e2" }, detalle: { dias: "3" } }).detalle, { dias: "3" });
});

test("cambio de estado por la noche (motivo PERIODO) no pide toast; otro sí, venga donde venga el motivo", () => {
  assert.equal(A.debeAvisarCambioDeEstado({ tipo: "CAMBIO_DE_ESTADO", datos: { motivo: "PERIODO" } }), false);
  assert.equal(A.debeAvisarCambioDeEstado({ tipo: "CAMBIO_DE_ESTADO", motivo: "PERIODO" }), false);
  assert.equal(A.debeAvisarCambioDeEstado({ tipo: "CAMBIO_DE_ESTADO", datos: { motivo: "LECTURA" } }), true);
  assert.equal(A.debeAvisarCambioDeEstado({ tipo: "CAMBIO_DE_ESTADO", datos: {} }), true, "sin motivo (backend viejo) sí avisa");
});

test("acariciar: 201 es una caricia nueva con su id; 200 (repetida en 10 s) no hace nada más", () => {
  assert.deepEqual(A.caricia({ status: 201, cuerpo: { id: "e1", tipo: "ACARICIAR", estado: "HECHA", creadaEn: "t" } }), { nueva: true, id: "e1", en: "t" });
  assert.deepEqual(A.caricia({ status: 200, cuerpo: { id: "e1", estado: "HECHA" } }), { nueva: false });
  assert.deepEqual(A.caricia(null), { nueva: false });
});

test("suscripción por planta: un solo destino, reparte por tipo e ignora otra planta o un tipo sin manejador", () => {
  const llamadas = [];
  const suscripciones = [];
  const suscribir = (destino, oyente) => {
    suscripciones.push({ destino, oyente });
    return () => llamadas.push(`baja ${destino}`);
  };
  const destinoDePlanta = (id) => `/user/queue/plantas/${id}`;
  const baja = A.suscribirAPlanta(suscribir, destinoDePlanta, "p1", {
    EVENTO_DE_MASCOTA: (m) => llamadas.push(`mascota ${m.datos.evento}`),
    SALUD_DE_LA_MATERA: (m) => llamadas.push(`salud ${m.datos.estado}`),
  });
  assert.equal(suscripciones.length, 1);
  assert.equal(suscripciones[0].destino, "/user/queue/plantas/p1");
  const oir = suscripciones[0].oyente;
  assert.equal(oir({ tipo: "EVENTO_DE_MASCOTA", datos: { plantaId: "p1", evento: "REGADA" } }), true);
  assert.equal(oir({ tipo: "SALUD_DE_LA_MATERA", datos: { plantaId: "p1", estado: "FALLA" } }), true);
  assert.equal(oir({ tipo: "EVENTO_DE_MASCOTA", datos: { plantaId: "otra", evento: "REGADA" } }), false);
  assert.equal(oir({ tipo: "DIAGNOSTICO_NUEVO", datos: { plantaId: "p1" } }), false);
  assert.equal(oir(null), false);
  baja();
  assert.deepEqual(llamadas, ["mascota REGADA", "salud FALLA", "baja /user/queue/plantas/p1"]);
});

test("línea de tiempo: el aviso se vuelve evento y se junta sin repetir, del más reciente al más antiguo", () => {
  const aviso = { tipo: "EVENTO_DE_MASCOTA", datos: { plantaId: "p", evento: "ACARICIADA", eventoId: "e3", ocurridoEn: "2026-11-16T15:00:00Z", vitalidad: "64", animo: "FELIZ" }, detalle: {} };
  const nuevo = A.eventoDesdeAviso(aviso);
  assert.deepEqual(nuevo, { id: "e3", tipo: "ACARICIADA", ocurridoEn: "2026-11-16T15:00:00Z", detalle: {} });
  const actuales = [{ id: "e2", tipo: "REGADA", ocurridoEn: "2026-11-16T14:00:00Z" }, { id: "e1", tipo: "RACHA", ocurridoEn: "2026-11-16T07:00:00Z" }];
  const juntos = A.juntarEventos(actuales, [nuevo, { ...nuevo }, actuales[0]]);
  assert.deepEqual(juntos.map((e) => e.id), ["e3", "e2", "e1"]);
  assert.equal(A.eventoDesdeAviso({ datos: {} }), null);
});
