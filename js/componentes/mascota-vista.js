// La mascota tal como la usan las vistas (F44): dibujo de la familia de la especie + su idle + el toque. Envuelve
// `crearMascota` (mascota.js) con lo que cada pantalla necesita: elegir la familia por el nombre de la especie
// (`familiaDe`, la misma tabla que el firmware), pintar el estado del diagnóstico, correr el idle a 20 cuadros por
// segundo (con movimiento reducido queda quieta) y, si se pide, reaccionar al toque con el saludo.
import { h } from "../ui.js";
import { crearMascota } from "./mascota.js";
import { familiaDe } from "./especie.js";
import { animarMascota, hayMovimiento } from "../animaciones.js";

/**
 * Devuelve { nodo, mascota, familia, aplicar(estado), morder(), saludar(), iniciar(), parar() }.
 *  - `especie` (texto del catálogo) o `familia` (ya resuelta; gana si viene) escogen el dibujo.
 *  - `estado`: SALUDABLE | EN_RIESGO | CRITICO | null (sin diagnóstico: se dibuja saludable y se atenúa por CSS).
 *  - `toque`: el nodo es un botón («Saludar a <nombre>») que responde al clic, al toque y a Enter o Espacio.
 *    Dentro de un enlace (el tablero) el toque NO navega: solo saluda.
 *  - `alTocar`: gancho opcional, se llama en cada toque (ahí irá `acariciarMascota` de api.js cuando exista).
 *  - `animar: false`: no arranca el idle (la escena lo arranca cuando la muestra).
 */
export function crearMascotaVista({ especie, familia, estado = null, clase = "", nombre = "", toque = false, alTocar = null, animar = true } = {}) {
  const mascota = crearMascota(familia || familiaDe(especie), { estado, clase });
  let detener = null;

  function iniciar() {
    if (!detener) detener = animarMascota(mascota);
  }
  function parar() {
    if (detener) detener();
    detener = null;
  }
  /** Lleva la mascota al estado del diagnóstico. Sin idle corriendo (movimiento reducido) repinta la pose quieta. */
  function aplicar(nuevo) {
    mascota.ponerEstado(nuevo);
    if (!detener || !hayMovimiento()) mascota.pintar(0, { reposo: true });
  }

  let nodo = mascota.nodo;
  function saludar() {
    mascota.saludar({ reducido: !hayMovimiento() });
    if (alTocar) alTocar();
  }
  if (toque) {
    nodo = h("div", { class: "mascota-toque", role: "button", tabindex: "0", "aria-label": nombre ? `Saludar a ${nombre}` : "Saludar a tu planta" }, mascota.nodo);
    nodo.addEventListener("click", (evento) => {
      evento.preventDefault(); // dentro de un enlace (tarjeta del tablero) no se navega
      evento.stopPropagation();
      saludar();
    });
    nodo.addEventListener("keydown", (evento) => {
      if (evento.key !== "Enter" && evento.key !== " ") return;
      evento.preventDefault();
      evento.stopPropagation();
      saludar();
    });
  }

  aplicar(estado);
  if (animar) iniciar();
  return { nodo, mascota, familia: mascota.familia, aplicar, morder: () => mascota.morder(), saludar, iniciar, parar };
}
