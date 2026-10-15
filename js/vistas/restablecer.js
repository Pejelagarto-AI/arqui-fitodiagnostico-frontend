// RF-A8: elegir contraseña nueva desde el enlace del correo (#/restablecer?token=...).
// 410 RESTABLECIMIENTO_NO_VIGENTE: el enlace ya se usó, caducó o la contraseña cambió.
import { restablecerContrasena } from "../api.js";
import { h, campo, crearAviso, conCarga, limpiarErroresDeFormulario, marcarCampoConError } from "../ui.js";

export const titulo = "Nueva contraseña";

export function montar(contenedor, ctx) {
  const token = ctx.query.get("token");
  if (!token) {
    const aviso = crearAviso();
    aviso.mostrar("El enlace está incompleto: falta el token. Pide uno nuevo.");
    contenedor.append(
      h("section", { class: "tarjeta tarjeta--angosta" }, h("h2", { "data-titulo": "" }, "Nueva contraseña"), aviso.elemento,
        h("p", {}, h("a", { href: "#/recuperar" }, "Pedir un enlace nuevo"))),
    );
    return;
  }

  const aviso = crearAviso();
  const enlaceNuevo = h("p", { hidden: true }, h("a", { href: "#/recuperar" }, "Pedir un enlace nuevo"));
  const nueva = campo({ id: "restablecer-nueva", nombre: "contrasenaNueva", etiqueta: "Contraseña nueva", tipo: "password", autocomplete: "new-password", minlength: "8", maxlength: "72", ayuda: "Entre 8 y 72 caracteres." });
  const repetida = campo({ id: "restablecer-repetida", nombre: "repetida", etiqueta: "Repite la contraseña", tipo: "password", autocomplete: "new-password" });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-restablecer" }, "Cambiar contraseña");

  const formulario = h("form", { id: "formulario-restablecer", novalidate: true }, nueva.contenedor, repetida.contenedor, aviso.elemento, enlaceNuevo, boton);
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    aviso.limpiar();
    if (nueva.input.value !== repetida.input.value) {
      repetida.error("Las contraseñas no coinciden.");
      repetida.input.focus();
      return;
    }
    try {
      await conCarga(boton, "Guardando…", () => restablecerContrasena(token, nueva.input.value));
      ctx.irA("/entrar?restablecida=1");
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) aviso.mostrar(error);
      if (error.status === 410) enlaceNuevo.hidden = false;
    }
  });

  contenedor.append(h("section", { class: "tarjeta tarjeta--angosta" }, h("h2", { "data-titulo": "" }, "Nueva contraseña"), formulario));
}
