// Las frases con personalidad de la mascota, copiadas TAL CUAL de `firmware/sprites/frases.json` del backend (fase 14,
// D191, D199): una sola fuente para la OLED y el front (regla de paridad del 12-nov). Familia x ánimo y familia x evento,
// ASCII y hasta 13 caracteres (la fila de la OLED mide 78 px a 6 px por carácter). La familia es la de `familiaDe`
// (especie.js); la especie sin mascota usa `generica`. RIEGO_DECLARADO no tiene frase (D192). No se edita a mano:
// `tests/mascota-frases.test.mjs` compara esta tabla con el JSON del backend y `tools/comparar-mascotas.py` también.
// Puro: sin DOM ni red.

export const MAXIMO = 13;

export const ANIMO = Object.freeze({
  girasol: Object.freeze({
    FELIZ: "todo bello!",
    CANSADA: "poquita pila",
    SEDIENTA: "agua, porfa!",
    AHOGADA: "mucha agua ya",
    CON_FRIO: "brrr, frio",
    CON_CALOR: "uf, que calor",
    A_OSCURAS: "y el sol?",
    DESLUMBRADA: "me encandilo",
    DESMAYADA: "me fui... x_x",
    DORMIDA: "zzz... sol...",
    SIN_DATOS: "y mis datos?",
  }),
  cactus: Object.freeze({
    FELIZ: "aqui, firme.",
    CANSADA: "necesito paz",
    SEDIENTA: "una gotica va",
    AHOGADA: "me ahogo!",
    CON_FRIO: "frio. raro.",
    CON_CALOR: "esto si arde",
    A_OSCURAS: "oscuro aqui",
    DESLUMBRADA: "mucha luz, ya",
    DESMAYADA: "x_x",
    DORMIDA: "zzz",
    SIN_DATOS: "...",
  }),
  suculenta: Object.freeze({
    FELIZ: "todo en calma",
    CANSADA: "despacito...",
    SEDIENTA: "un sorbo, ya",
    AHOGADA: "basta de agua",
    CON_FRIO: "una cobijita",
    CON_CALOR: "mucho sol, ya",
    A_OSCURAS: "algo de luz",
    DESLUMBRADA: "sombra, porfa",
    DESMAYADA: "me desmaye...",
    DORMIDA: "zzz...",
    SIN_DATOS: "esperando...",
  }),
  helecho: Object.freeze({
    FELIZ: "hoy si, bien",
    CANSADA: "ya no puedo",
    SEDIENTA: "me seco, agua",
    AHOGADA: "glu glu glu",
    CON_FRIO: "me congelo!",
    CON_CALOR: "me derrito!",
    A_OSCURAS: "no veo nada!",
    DESLUMBRADA: "me quemo!",
    DESMAYADA: "adios mundo",
    DORMIDA: "zzz (ronca)",
    SIN_DATOS: "nadie me mide",
  }),
  carnivora: Object.freeze({
    FELIZ: "no molestar.",
    CANSADA: "dejame en paz",
    SEDIENTA: "AGUA. YA.",
    AHOGADA: "me ahogas!",
    CON_FRIO: "frio. odio.",
    CON_CALOR: "arde. quita.",
    A_OSCURAS: "luz. ahora.",
    DESLUMBRADA: "apaga eso.",
    DESMAYADA: "x_x (grr)",
    DORMIDA: "zzz. no tocar",
    SIN_DATOS: "datos. ahora.",
  }),
  generica: Object.freeze({
    FELIZ: "estoy bien",
    CANSADA: "estoy cansada",
    SEDIENTA: "tengo sed",
    AHOGADA: "mucha agua",
    CON_FRIO: "tengo frio",
    CON_CALOR: "tengo calor",
    A_OSCURAS: "muy oscuro",
    DESLUMBRADA: "me deslumbra",
    DESMAYADA: "me desmaye",
    DORMIDA: "zzz",
    SIN_DATOS: "aun no se",
  }),
});

export const EVENTO = Object.freeze({
  girasol: Object.freeze({
    REGADA: "gracias!",
    SALIO_AL_SOL: "solecito!",
    DESMAYO: "me fui... x_x",
    REVIVIO: "volvi!",
    ACARICIADA: "jiji",
    RACHA: "racha! :D",
    RIEGO_CONFIRMADO: "si me regaron",
    RIEGO_DESMENTIDO: "no senti nada",
  }),
  cactus: Object.freeze({
    REGADA: "ok. gracias.",
    SALIO_AL_SOL: "sol. bien.",
    DESMAYO: "x_x",
    REVIVIO: "sigo aqui.",
    ACARICIADA: "ojo, pincho",
    RACHA: "racha.",
    RIEGO_CONFIRMADO: "confirmado.",
    RIEGO_DESMENTIDO: "no lo creo.",
  }),
  suculenta: Object.freeze({
    REGADA: "que rico",
    SALIO_AL_SOL: "que calorcito",
    DESMAYO: "me desmaye...",
    REVIVIO: "ya volvi",
    ACARICIADA: "mmm, gracias",
    RACHA: "otro dia bien",
    RIEGO_CONFIRMADO: "si, lo senti",
    RIEGO_DESMENTIDO: "no llego nada",
  }),
  helecho: Object.freeze({
    REGADA: "al fin! agua!",
    SALIO_AL_SOL: "luz! luz!",
    DESMAYO: "adios mundo",
    REVIVIO: "revivi!!",
    ACARICIADA: "mas, mas!",
    RACHA: "soy un heroe",
    RIEGO_CONFIRMADO: "si me regaron",
    RIEGO_DESMENTIDO: "mentira!",
  }),
  carnivora: Object.freeze({
    REGADA: "bien. sigue.",
    SALIO_AL_SOL: "sol. acepto.",
    DESMAYO: "x_x (grr)",
    REVIVIO: "volvi. ojo.",
    ACARICIADA: "nam. casi.",
    RACHA: "racha. obvio.",
    RIEGO_CONFIRMADO: "ya lo sabia.",
    RIEGO_DESMENTIDO: "mentiroso.",
  }),
  generica: Object.freeze({
    REGADA: "me regaron",
    SALIO_AL_SOL: "sali al sol",
    DESMAYO: "me desmaye",
    REVIVIO: "revivi",
    ACARICIADA: "gracias",
    RACHA: "racha!",
    RIEGO_CONFIRMADO: "si me regaron",
    RIEGO_DESMENTIDO: "no lo note",
  }),
});

/** La frase de la familia para un ánimo, o null si el ánimo no se conoce (la OLED se queda en el estado, D192). */
export function fraseDeAnimoDe(familia, animo) {
  const f = ANIMO[familia] || ANIMO.generica;
  return Object.hasOwn(f, animo) ? f[animo] : null;
}

/** La frase de la familia para un evento, o null si no tiene (RIEGO_DECLARADO y los tipos nuevos). */
export function fraseDeEventoDe(familia, tipo) {
  const f = EVENTO[familia] || EVENTO.generica;
  return Object.hasOwn(f, tipo) ? f[tipo] : null;
}
