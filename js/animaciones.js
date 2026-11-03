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
