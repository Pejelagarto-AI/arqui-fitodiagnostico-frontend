// RF-A2: iniciar sesión. Si venimos de una pantalla protegida o de un enlace de
// invitación, `?volver=` trae la ruta a la que regresar.
import { iniciarSesion } from "../api.js";
import * as sesion from "../sesion.js";
import { h, campo, crearAviso, crearNota, conCarga, limpiarErroresDeFormulario, marcarCampoConError } from "../ui.js";

export const titulo = "Iniciar sesión";

// Solo se vuelve a rutas internas del front (empiezan con una sola barra).
export function rutaDeRetorno(query) {
  const volver = query.get("volver");
  return volver && volver.startsWith("/") && !volver.startsWith("//") ? volver : "/plantas";
}

export function montar(contenedor, ctx) {
  const aviso = crearAviso();
  const nota = crearNota();
  if (ctx.query.get("restablecida")) nota.mostrar("Contraseña cambiada. Inicia sesión con la nueva.");
  const correo = campo({ id: "entrar-correo", nombre: "correo", etiqueta: "Correo", tipo: "email", autocomplete: "email" });
  const contrasena = campo({ id: "entrar-contrasena", nombre: "contrasena", etiqueta: "Contraseña", tipo: "password", autocomplete: "current-password" });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-entrar" }, "Entrar");
  const volver = ctx.query.get("volver");

  const formulario = h("form", { id: "formulario-entrar", novalidate: true }, correo.contenedor, contrasena.contenedor, aviso.elemento, boton);
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    aviso.limpiar();
    try {
      const respuesta = await conCarga(boton, "Entrando…", () => iniciarSesion(correo.input.value.trim(), contrasena.input.value));
      sesion.iniciar(respuesta);
      ctx.irA(rutaDeRetorno(ctx.query));
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) aviso.mostrar(error);
    }
  });

  contenedor.append(
    h("section", { class: "tarjeta tarjeta--angosta" },
      h("h2", { "data-titulo": "" }, "Iniciar sesión"),
      nota.elemento,
      formulario,
      h("p", { class: "enlaces-secundarios" },
        h("a", { href: "#/recuperar" }, "¿Olvidaste tu contraseña?"), " · ",
        h("a", { href: volver ? `#/registro?volver=${encodeURIComponent(volver)}` : "#/registro" }, "Crear cuenta"),
      ),
    ),
  );
}
