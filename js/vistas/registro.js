// RF-A1: registrarse. El backend devuelve el usuario (201), no un token (D30):
// al terminar se inicia sesión con las mismas credenciales.
import { registrar, iniciarSesion } from "../api.js";
import * as sesion from "../sesion.js";
import { h, campo, crearAviso, conCarga, limpiarErroresDeFormulario, marcarCampoConError } from "../ui.js";
import { rutaDeRetorno } from "./entrar.js";

export const titulo = "Crear cuenta";

export function montar(contenedor, ctx) {
  const aviso = crearAviso();
  const nombre = campo({ id: "registro-nombre", nombre: "nombre", etiqueta: "Nombre", autocomplete: "name", maxlength: "120" });
  const correo = campo({ id: "registro-correo", nombre: "correo", etiqueta: "Correo", tipo: "email", autocomplete: "email", maxlength: "254" });
  const contrasena = campo({ id: "registro-contrasena", nombre: "contrasena", etiqueta: "Contraseña", tipo: "password", autocomplete: "new-password", minlength: "8", maxlength: "72", ayuda: "Entre 8 y 72 caracteres." });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-registrar" }, "Crear cuenta");

  const formulario = h("form", { id: "formulario-registro", novalidate: true }, nombre.contenedor, correo.contenedor, contrasena.contenedor, aviso.elemento, boton);
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    aviso.limpiar();
    try {
      await conCarga(boton, "Creando…", async () => {
        const datos = { nombre: nombre.input.value.trim(), correo: correo.input.value.trim(), contrasena: contrasena.input.value };
        await registrar(datos);
        sesion.iniciar(await iniciarSesion(datos.correo, datos.contrasena));
      });
      ctx.irA(rutaDeRetorno(ctx.query));
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) aviso.mostrar(error);
    }
  });

  contenedor.append(
    h("section", { class: "tarjeta tarjeta--angosta" },
      h("h2", { "data-titulo": "" }, "Crear cuenta"),
      formulario,
      h("p", { class: "enlaces-secundarios" }, "¿Ya tienes cuenta? ", h("a", { href: "#/entrar" }, "Inicia sesión")),
    ),
  );
}
