// La mascota tal como la usan las vistas (F44): dibujo de la familia de la especie + su idle + el toque. Envuelve
// `crearMascota` (mascota.js) con lo que cada pantalla necesita: elegir la familia por el nombre de la especie
// (`familiaDe`, la misma tabla que el firmware), pintar el estado del diagnóstico, correr el idle a 20 cuadros por
// segundo (con movimiento reducido queda quieta) y, si se pide, reaccionar al toque con el saludo.
import { h } from "../ui.js";
import { crearMascota } from "./mascota.js";
import { familiaDe } from "./especie.js";
import { animarMascota, hayMovimiento } from "../animaciones.js";

/**
 * Devuelve { nodo, mascota, familia, aplicar(estado, periodo, extras), morder(), saludar(), saludarSolo(), regar(), encolar(tipo), iniciar(), parar() }.
 *  - `especie` (texto del catálogo) o `familia` (ya resuelta; gana si viene) escogen el dibujo.
 *  - `estado`: SALUDABLE | EN_RIESGO | CRITICO | null (sin diagnóstico: se dibuja saludable y se atenúa por CSS).
 *  - `periodo`: DIA | NOCHE del diagnóstico (F49); de noche la mascota duerme. Sin dato, de día.
 *  - `toque`: el nodo es un botón («Saludar a <nombre>») que responde al clic, al toque y a Enter o Espacio.
 *    Si la mascota queda junto a un enlace de toda la tarjeta (el tablero), va por encima y el toque NO navega: solo saluda.
 *  - `alTocar`: gancho opcional, se llama en cada toque después del saludo local.
 *  - `alToque` (F56): REEMPLAZA el saludo local del toque. La pestaña «Mascota» del dueño lo usa para encolar el evento
 *    ACARICIADA (saludo, corazón y frase) y llamar a `acariciarMascota`; sin él, el toque es solo el saludo.
 *  - `eventos` (F56): la cola de eventos compartida (`crearReproductor`); sin ella cada mascota tiene la suya.
 *  - `accesorio` (F56): NINGUNO, SOMBRERO, MONO o GAFAS.
 *  - `animar: false`: no arranca el idle (la escena lo arranca cuando la muestra).
 */
export function crearMascotaVista({ especie, familia, estado = null, periodo = null, clase = "", nombre = "", toque = false, alTocar = null, alToque = null, animar = true, eventos = null, accesorio = "NINGUNO" } = {}) {
  const mascota = crearMascota(familia || familiaDe(especie), { estado, periodo, clase, eventos, accesorio });
  let detener = null;

  function iniciar() {
    if (!detener) detener = animarMascota(mascota);
  }
  function parar() {
    if (detener) detener();
    detener = null;
  }
  /**
   * Lleva la mascota al estado y al periodo del diagnóstico. `extras` (F56): `desmayada` (el ánimo del servidor es
   * DESMAYADA) y `accesorio`; lo que no venga no se toca. Sin idle corriendo (movimiento reducido) repinta la pose quieta.
   */
  function aplicar(nuevo, periodo = null, extras = {}) {
    if (extras.desmayada !== undefined) mascota.ponerDesmayada(extras.desmayada);
    if (extras.accesorio !== undefined) mascota.ponerAccesorio(extras.accesorio);
    mascota.ponerEstado(nuevo);
    mascota.ponerPeriodo(periodo);
    if (!detener || !hayMovimiento()) mascota.pintar(0, { reposo: true });
  }

  let nodo = mascota.nodo;
  function saludar() {
    if (alToque) alToque();
    else mascota.saludar({ reducido: !hayMovimiento() });
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
  /** F56: pone un evento en la cola de la mascota (de a uno, 3000 ms cada uno). */
  const encolar = (tipo) => mascota.cola().empujar(tipo);
  /** El saludo sin el gancho `alTocar`: para cuando el saludo lo dispara un aviso y no un toque. */
  const saludarSolo = () => mascota.saludar({ reducido: !hayMovimiento() });
  return { nodo, mascota, familia: mascota.familia, aplicar, morder: () => mascota.morder(), saludar, saludarSolo, regar, encolar, iniciar, parar };
}
