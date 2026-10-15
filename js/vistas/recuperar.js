// RF-A7: pedir el enlace para restablecer la contraseña. El backend responde
// 202 igual exista o no el correo (no enumera cuentas); el front hace lo mismo.
import { solicitarRecuperacion } from "../api.js";
import { h, campo, crearAviso, crearNota, conCarga, limpiarErroresDeFormulario, marcarCampoConError } from "../ui.js";

export const titulo = "Recuperar contraseña";

export function montar(contenedor) {
  const aviso = crearAviso();
  const nota = crearNota();
  const correo = campo({ id: "recuperar-correo", nombre: "correo", etiqueta: "Correo de tu cuenta", tipo: "email", autocomplete: "email" });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-recuperar" }, "Enviar enlace");

  const formulario = h("form", { id: "formulario-recuperar", novalidate: true }, correo.contenedor, aviso.elemento, boton);
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    aviso.limpiar();
    nota.limpiar();
    try {
      const respuesta = await conCarga(boton, "Enviando…", () => solicitarRecuperacion(correo.input.value.trim()));
      nota.mostrar((respuesta && respuesta.mensaje) || "Si el correo está registrado, te enviamos un enlace.");
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) aviso.mostrar(error);
    }
  });

  contenedor.append(
    h("section", { class: "tarjeta tarjeta--angosta" },
      h("h2", { "data-titulo": "" }, "Recuperar contraseña"),
      h("p", { class: "texto-suave" }, "Te enviaremos un enlace (vale una hora) para elegir una contraseña nueva."),
      formulario,
      nota.elemento,
      h("p", { class: "enlaces-secundarios" }, h("a", { href: "#/entrar" }, "Volver a iniciar sesión")),
    ),
  );
}
