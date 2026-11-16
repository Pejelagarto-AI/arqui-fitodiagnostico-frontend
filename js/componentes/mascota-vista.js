// La mascota tal como la usan las vistas (F44): dibujo de la familia de la especie + su idle + el toque. Envuelve
// `crearMascota` (mascota.js) con lo que cada pantalla necesita: elegir la familia por el nombre de la especie
// (`familiaDe`, la misma tabla que el firmware), pintar el estado del diagnóstico, correr el idle a 20 cuadros por
// segundo (con movimiento reducido queda quieta) y, si se pide, reaccionar al toque con el saludo.
import { h } from "../ui.js";
import { crearMascota } from "./mascota.js";
import { familiaDe } from "./especie.js";
import { animarMascota, hayMovimiento } from "../animaciones.js";

/**
 * Devuelve { nodo, mascota, familia, aplicar(estado, periodo), morder(), saludar(), saludarSolo(), regar(), iniciar(), parar() }.
 *  - `especie` (texto del catálogo) o `familia` (ya resuelta; gana si viene) escogen el dibujo.
 *  - `estado`: SALUDABLE | EN_RIESGO | CRITICO | null (sin diagnóstico: se dibuja saludable y se atenúa por CSS).
 *  - `periodo`: DIA | NOCHE del diagnóstico (F49); de noche la mascota duerme. Sin dato, de día.
 *  - `toque`: el nodo es un botón («Saludar a <nombre>») que responde al clic, al toque y a Enter o Espacio.
 *    Si la mascota queda junto a un enlace de toda la tarjeta (el tablero), va por encima y el toque NO navega: solo saluda.
 *  - `alTocar`: gancho opcional, se llama en cada toque (la pestaña «Mascota» llama ahí a `acariciarMascota`, F54).
 *  - `animar: false`: no arranca el idle (la escena lo arranca cuando la muestra).
 */
export function crearMascotaVista({ especie, familia, estado = null, periodo = null, clase = "", nombre = "", toque = false, alTocar = null, animar = true } = {}) {
  const mascota = crearMascota(familia || familiaDe(especie), { estado, periodo, clase });
  let detener = null;

  function iniciar() {
    if (!detener) detener = animarMascota(mascota);
  }
  function parar() {
    if (detener) detener();
    detener = null;
  }
  /** Lleva la mascota al estado y al periodo del diagnóstico. Sin idle corriendo (movimiento reducido) repinta la pose quieta. */
  function aplicar(nuevo, periodo = null) {
    mascota.ponerEstado(nuevo);
    mascota.ponerPeriodo(periodo);
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

  aplicar(estado, periodo);
  if (animar) iniciar();
  /** F54: la regaron (evento REGADA): la suculenta como en la OLED, las demás un parpadeo doble. */
  const regar = () => mascota.regar({ reducido: !hayMovimiento() });
  /** El saludo sin el gancho `alTocar`: para cuando el saludo lo dispara un aviso y no un toque. */
  const saludarSolo = () => mascota.saludar({ reducido: !hayMovimiento() });
  return { nodo, mascota, familia: mascota.familia, aplicar, morder: () => mascota.morder(), saludar, saludarSolo, regar, iniciar, parar };
}
