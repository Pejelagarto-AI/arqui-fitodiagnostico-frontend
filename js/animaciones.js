// Envoltura de GSAP (js/vendor/gsap.min.js, global window.gsap). Toda animación del front pasa por
// aquí y cumple tres reglas:
//  - con prefers-reduced-motion, o si GSAP no cargó, no hace nada: quien llama ya dejó el estado
//    final en el DOM, así que la pantalla se ve completa y sin movimiento;
//  - el valor real (el que leen los lectores de pantalla y las pruebas) está en el DOM desde el
//    primer instante: solo se anima una capa visual aparte;
//  - ninguna animación queda en bucle salvo el balanceo de las hojas, que se detiene al salir;
//  - las que el usuario puede provocar de nuevo a mitad de camino (cambiar de estado, nueva lectura) son
//    interrumpibles: se matan y la nueva parte del valor actual. Ninguna bloquea la entrada (no hay
//    pointer-events:none ni esperas a que termine una animación para seguir).

function gsapDisponible() {
  return typeof globalThis.gsap !== "undefined" && typeof globalThis.matchMedia === "function";
}

/** Verdadero si el usuario pidió menos movimiento. */
export function movimientoReducido() {
  return typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function puedeAnimar() {
  return gsapDisponible() && !movimientoReducido();
}

/** Entrada escalonada de bloques (tarjetas, filas). */
export function entrada(nodos, { y = 12, duracion = 0.45, escalon = 0.08, retraso = 0 } = {}) {
  const lista = [...(nodos instanceof Node ? [nodos] : nodos)].filter(Boolean);
  if (!puedeAnimar() || lista.length === 0) return;
  globalThis.gsap.from(lista, { opacity: 0, y, duration: duracion, stagger: escalon, delay: retraso, ease: "power2.out", clearProps: "opacity,transform" });
}

/** La barra de un parámetro se llena de izquierda a derecha. */
export function llenarBarra(barra, { retraso = 0 } = {}) {
  if (!puedeAnimar() || !barra) return;
  globalThis.gsap.fromTo(barra, { scaleX: 0 }, { scaleX: 1, duration: 1, delay: retraso, ease: "power3.out", clearProps: "transform" });
}

/**
 * Cuenta de 0 al valor sobre una capa visual (.num-anim). El valor real en .num-valor ya está en el
 * DOM; mientras cuenta, el CSS lo oculta con visibility (data-animando) y al terminar lo devuelve.
 */
export function contar(contenedorNumero, valor, { retraso = 0 } = {}) {
  if (!puedeAnimar() || !contenedorNumero || !Number.isFinite(valor)) return;
  const capa = contenedorNumero.querySelector(".num-anim");
  if (!capa) return;
  const entero = Number.isInteger(valor);
  const proxy = { v: 0 };
  contenedorNumero.dataset.animando = "";
  capa.textContent = "0";
  globalThis.gsap.to(proxy, {
    v: valor,
    duration: 1,
    delay: retraso,
    ease: "power2.out",
    onUpdate() {
      capa.textContent = entero ? String(Math.round(proxy.v)) : proxy.v.toFixed(1);
    },
    onComplete() {
      delete contenedorNumero.dataset.animando;
    },
  });
}

/** La línea de la minigráfica se dibuja con strokeDashoffset (propuesta 2). */
export function dibujarLinea(linea, { retraso = 0 } = {}) {
  if (!puedeAnimar() || !linea || typeof linea.getTotalLength !== "function") return;
  const largo = linea.getTotalLength();
  if (!(largo > 0)) return;
  globalThis.gsap.fromTo(linea, { strokeDasharray: largo, strokeDashoffset: largo }, { strokeDashoffset: 0, duration: 1.1, delay: retraso, ease: "power2.inOut", clearProps: "strokeDasharray,strokeDashoffset" });
}

/** La píldora de estado se encoge, cambia el texto y rebota. `aplicar` deja el estado nuevo en el DOM. */
export function cambiarEstado(nodo, aplicar) {
  if (!puedeAnimar() || !nodo) {
    aplicar();
    return;
  }
  const { gsap } = globalThis;
  gsap.killTweensOf(nodo);
  gsap.timeline({ defaults: { overwrite: "auto" } })
    .to(nodo, { scale: 0.9, opacity: 0.3, duration: 0.15, onComplete: aplicar })
    .to(nodo, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2.5)", clearProps: "opacity,transform" });
}

const interpolaciones = new WeakMap();

/**
 * Lleva un conjunto de números (nivel del agua, caída de las hojas, brillo del sol) de `desde` a `hasta`
 * llamando a `alActualizar(valores)` en cada cuadro. Se anima un objeto, no el SVG: así no hay conflicto
 * con los atributos transform que ya pone la ilustración. Devuelve false si no se animó (el llamador
 * aplica el estado final).
 */
export function interpolar(clave, desde, hasta, alActualizar, { duracion = 1.2 } = {}) {
  if (!puedeAnimar()) return false;
  // Interrumpible (F29): si ya había una animación a medias, la nueva arranca de DONDE VA ESA (su valor vivo),
  // no de donde iba a terminar; así un cambio de estado a mitad de camino no pega un salto.
  const previa = interpolaciones.get(clave);
  let origen = desde;
  if (previa) {
    origen = { ...previa.proxy };
    previa.tween.kill();
  }
  const proxy = { ...origen };
  const tween = globalThis.gsap.to(proxy, {
    ...hasta,
    duration: duracion,
    ease: "power2.out",
    onUpdate: () => alActualizar({ ...proxy }),
    onComplete: () => interpolaciones.delete(clave),
  });
  interpolaciones.set(clave, { tween, proxy });
  return true;
}

/** Balanceo leve y continuo de las hojas (único bucle). Devuelve la función que lo detiene. */
export function balancear(grupo) {
  if (!puedeAnimar() || !grupo) return () => {};
  const tween = globalThis.gsap.to(grupo, { rotation: 1.5, svgOrigin: "130 150", duration: 2.4, yoyo: true, repeat: -1, ease: "sine.inOut" });
  return () => tween.kill();
}

/**
 * Radar del paso «Buscando» (F36): tres ondas que se expanden y se apagan, escalonadas, y un barrido que gira.
 * Son los únicos bucles del asistente y se detienen al devolver la función de limpieza. Con movimiento
 * reducido (o sin GSAP) no hace nada: el SVG ya tiene las ondas dibujadas quietas.
 */
export function radar({ ondas, barrido }) {
  if (!puedeAnimar()) return () => {};
  const { gsap } = globalThis;
  const ondasLista = [...ondas];
  const lineas = ondasLista.map((onda, i) =>
    gsap.fromTo(onda, { scale: 0.25, opacity: 0.7, svgOrigin: "130 130" }, { scale: 1, opacity: 0, svgOrigin: "130 130", duration: 2.7, delay: i * 0.9, repeat: -1, ease: "power1.out" }),
  );
  const giro = barrido ? gsap.to(barrido, { rotation: 360, svgOrigin: "130 130", duration: 3.2, repeat: -1, ease: "none" }) : null;
  return () => {
    lineas.forEach((t) => t.kill());
    if (giro) giro.kill();
  };
}

/** El anillo del paso «Conectando» gira mientras se espera (bucle; se detiene con la función devuelta). */
export function girar(nodo) {
  if (!puedeAnimar() || !nodo) return () => {};
  const tween = globalThis.gsap.to(nodo, { rotation: 360, svgOrigin: "50 50", duration: 1.1, repeat: -1, ease: "none" });
  return () => tween.kill();
}

/**
 * Éxito de la vinculación (F36): el aro aparece con un rebote, la plantica crece desde la matera (el tallo
 * sube y las hojas se abren una a una) y el chulo se dibuja. Todo con `from`: el estado final ya está en el
 * DOM, así que con movimiento reducido la pantalla se ve completa y quieta.
 */
export function exito({ aro, planta, hojas, chulo, insignia }) {
  if (!puedeAnimar()) return;
  const { gsap } = globalThis;
  const linea = gsap.timeline({ defaults: { ease: "power2.out" } });
  if (aro) linea.from(aro, { scale: 0.6, opacity: 0, svgOrigin: "130 130", duration: 0.5, ease: "back.out(1.8)", clearProps: "opacity,transform" });
  if (planta) linea.from(planta, { scaleY: 0, svgOrigin: "130 150", duration: 0.7, ease: "power3.out", clearProps: "transform" }, "-=0.2");
  const lista = [...(hojas || [])];
  if (lista.length) linea.from(lista, { scale: 0, opacity: 0, transformOrigin: "50% 100%", duration: 0.4, stagger: 0.12, ease: "back.out(2)", clearProps: "opacity,transform" }, "-=0.3");
  if (insignia) linea.from(insignia, { scale: 0, svgOrigin: "224 40", duration: 0.45, ease: "back.out(2.4)", clearProps: "transform" }, "-=0.1");
  if (chulo && typeof chulo.getTotalLength === "function") {
    const largo = chulo.getTotalLength();
    if (largo > 0) linea.fromTo(chulo, { strokeDasharray: largo, strokeDashoffset: largo }, { strokeDashoffset: 0, duration: 0.5, ease: "power2.inOut", clearProps: "strokeDasharray,strokeDashoffset" }, "-=0.1");
  }
}

/**
 * Un mordisco de la planta carnívora (llega una lectura nueva): las mandíbulas se cierran de golpe y vuelven a su
 * posición de reposo (abierta). Las mandíbulas son grupos SVG con un transform de reposo; GSAP parte de él y anima
 * `y`: 0 es la boca cerrada.
 */
export function morder(superior, inferior, { abiertaSup = -14, abiertaInf = 6 } = {}) {
  if (!puedeAnimar() || !superior || !inferior) return;
  const { gsap } = globalThis;
  gsap.killTweensOf([superior, inferior]);
  gsap.timeline()
    .to(superior, { y: 0, duration: 0.09, ease: "power2.in" }, 0)
    .to(inferior, { y: 0, duration: 0.09, ease: "power2.in" }, 0)
    .to(superior, { y: abiertaSup, duration: 0.5, ease: "elastic.out(1, 0.4)" }, 0.16)
    .to(inferior, { y: abiertaInf, duration: 0.5, ease: "elastic.out(1, 0.4)" }, 0.16);
}

/** La carnívora abre la boca de par en par y la cierra, dos veces, cada cierto rato. Devuelve la función que lo detiene. */
export function masticar(superior, inferior, { abiertaSup = -14, abiertaInf = 6 } = {}) {
  if (!puedeAnimar() || !superior || !inferior) return () => {};
  const { gsap } = globalThis;
  const linea = gsap.timeline({ repeat: -1, repeatDelay: 5.5, delay: 3 });
  for (let i = 0; i < 2; i++) {
    linea
      .to(superior, { y: abiertaSup - 8, duration: 0.3, ease: "power1.out" })
      .to(inferior, { y: abiertaInf + 4, duration: 0.3, ease: "power1.out" }, "<")
      .to(superior, { y: 0, duration: 0.16, ease: "power2.in" })
      .to(inferior, { y: 0, duration: 0.16, ease: "power2.in" }, "<");
  }
  linea.to(superior, { y: abiertaSup, duration: 0.4 }).to(inferior, { y: abiertaInf, duration: 0.4 }, "<");
  return () => {
    linea.kill();
    gsap.set(superior, { y: abiertaSup });
    gsap.set(inferior, { y: abiertaInf });
  };
}

/**
 * Entrada de la portada (F38), orquestada y sobria: la escena aparece, la planta crece desde la matera, el
 * globo salta, y el titular, la bajada y las acciones suben escalonados; los pasos de «Así funciona» llegan al
 * final. Una sola línea de tiempo, menos de 1,4 s, nada en bucle. Con movimiento reducido (o sin GSAP) no hace
 * nada: todo está ya en su sitio. Devuelve la función que la corta si el usuario sale antes.
 */
export function orquestarPortada({ escena, planta, globo, lecturas = [], textos = [], pasos = [] }) {
  if (!puedeAnimar()) return () => {};
  const { gsap } = globalThis;
  const linea = gsap.timeline({ defaults: { ease: "power2.out" } });
  if (escena) linea.from(escena, { opacity: 0, scale: 0.96, duration: 0.45, clearProps: "opacity,transform" }, 0);
  if (planta) linea.from(planta, { scale: 0.2, opacity: 0, svgOrigin: "130 150", duration: 0.7, ease: "back.out(1.4)", clearProps: "opacity,transform" }, 0.15);
  if (globo) linea.from(globo, { opacity: 0, scale: 0.7, y: 8, duration: 0.4, ease: "back.out(1.8)", clearProps: "opacity,transform" }, 0.6);
  if (lecturas.length) linea.from(lecturas, { opacity: 0, y: 8, duration: 0.3, stagger: 0.07, clearProps: "opacity,transform" }, 0.7);
  if (textos.length) linea.from(textos, { opacity: 0, y: 14, duration: 0.45, stagger: 0.08, clearProps: "opacity,transform" }, 0.2);
  if (pasos.length) linea.from(pasos, { opacity: 0, y: 16, duration: 0.45, stagger: 0.1, clearProps: "opacity,transform" }, 0.75);
  return () => linea.kill();
}

/**
 * Mira del lector de QR (F40): una línea que sube y baja dentro del recuadro de la cámara. Es un bucle y se
 * detiene con la función que devuelve. Con movimiento reducido (o sin GSAP) la línea queda quieta en el centro.
 */
export function barrerMira(linea, { recorrido = 76 } = {}) {
  if (!puedeAnimar() || !linea) return () => {};
  const tween = globalThis.gsap.fromTo(linea, { y: -recorrido / 2 }, { y: recorrido / 2, duration: 1.6, yoyo: true, repeat: -1, ease: "sine.inOut" });
  return () => {
    tween.kill();
    globalThis.gsap.set(linea, { clearProps: "transform" });
  };
}

/**
 * Lleva una caja (top, left, width, height en px; las que vengan) a su sitio. Lo usa el recorrido guiado (F39)
 * para mover el foco y el globo de una parada a otra. Interrumpible: una orden nueva pisa a la anterior. Con
 * movimiento reducido, sin GSAP o con `animar: false`, la caja queda en su sitio de una vez.
 */
export function moverCaja(nodo, caja, { animar = true, duracion = 0.32 } = {}) {
  if (!nodo) return;
  const destino = Object.fromEntries(Object.entries(caja).map(([clave, valor]) => [clave, Math.round(valor)]));
  if (animar && puedeAnimar()) {
    globalThis.gsap.to(nodo, { ...destino, duration: duracion, ease: "power2.out", overwrite: true });
    return;
  }
  if (gsapDisponible()) globalThis.gsap.killTweensOf(nodo);
  for (const [clave, valor] of Object.entries(destino)) nodo.style[clave] = `${valor}px`;
}

/** El globo del recorrido aparece con un salto corto. Sin movimiento, ya está. */
export function aparecer(nodo) {
  if (!puedeAnimar() || !nodo) return;
  globalThis.gsap.fromTo(nodo, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out", clearProps: "opacity,transform" });
}

/**
 * Idle de una mascota (F41): la pinta cuadro a cuadro con el reloj de GSAP (`gsap.ticker`) a 20 cuadros por segundo,
 * los mismos que la OLED (MS_FOTOGRAMA = 50). Qué se mueve y cuándo lo decide `mascota.pintar(ms)` con los números
 * del firmware. Bucle: se detiene con la función que devuelve, o solo, cuando la mascota sale del documento.
 * Con movimiento reducido (o sin GSAP) no corre: la mascota queda en su pose de reposo.
 */
export function animarMascota(mascota, { msPorCuadro = 50 } = {}) {
  if (!mascota) return () => {};
  if (!puedeAnimar()) {
    mascota.pintar(0, { reposo: true });
    return () => {};
  }
  const { gsap } = globalThis;
  const inicio = gsap.ticker.time;
  let ultimo = -Infinity;
  let estuvo = false;
  function cuadro(tiempo) {
    if (mascota.nodo.isConnected) estuvo = true;
    else if (estuvo) return detener();
    const ms = Math.round((tiempo - inicio) * 1000);
    if (ms - ultimo < msPorCuadro) return undefined;
    ultimo = ms;
    mascota.pintar(ms);
    return undefined;
  }
  function detener() {
    gsap.ticker.remove(cuadro);
  }
  gsap.ticker.add(cuadro);
  return detener;
}
