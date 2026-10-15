// RF-A4..A6: ver y editar los datos de la cuenta, cambiar la contraseña y eliminar la cuenta.
import { obtenerCuenta, actualizarCuenta, cambiarContrasena, eliminarCuenta } from "../api.js";
import * as sesion from "../sesion.js";
import { h, campo, crearAviso, crearNota, conCarga, confirmar, limpiarErroresDeFormulario, marcarCampoConError, toast } from "../ui.js";

export const titulo = "Mi perfil";

export async function montar(contenedor, ctx) {
  const cuenta = await obtenerCuenta();
  if (!ctx.vigente()) return;
  sesion.actualizarUsuario(cuenta);

  // ---- datos ----
  const avisoDatos = crearAviso();
  const notaDatos = crearNota();
  const nombre = campo({ id: "perfil-nombre", nombre: "nombre", etiqueta: "Nombre", valor: cuenta.nombre, maxlength: "120", autocomplete: "name" });
  const correo = campo({ id: "perfil-correo", nombre: "correo", etiqueta: "Correo", tipo: "email", valor: cuenta.correo, maxlength: "254", autocomplete: "email" });
  const botonDatos = h("button", { type: "submit", class: "boton boton-primario", id: "btn-guardar-perfil" }, "Guardar cambios");
  const formDatos = h("form", { id: "formulario-perfil", novalidate: true }, nombre.contenedor, correo.contenedor, avisoDatos.elemento, notaDatos.elemento, botonDatos);
  formDatos.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formDatos);
    avisoDatos.limpiar();
    notaDatos.limpiar();
    try {
      const actualizada = await conCarga(botonDatos, "Guardando…", () => actualizarCuenta({ nombre: nombre.input.value.trim(), correo: correo.input.value.trim() }));
      sesion.actualizarUsuario(actualizada);
      notaDatos.mostrar("Datos actualizados.");
    } catch (error) {
      if (!marcarCampoConError(formDatos, error)) avisoDatos.mostrar(error);
    }
  });

  // ---- contraseña ----
  const avisoClave = crearAviso();
  const notaClave = crearNota();
  const actual = campo({ id: "clave-actual", nombre: "contrasenaActual", etiqueta: "Contraseña actual", tipo: "password", autocomplete: "current-password" });
  const nueva = campo({ id: "clave-nueva", nombre: "contrasenaNueva", etiqueta: "Contraseña nueva", tipo: "password", autocomplete: "new-password", minlength: "8", maxlength: "72", ayuda: "Entre 8 y 72 caracteres." });
  const botonClave = h("button", { type: "submit", class: "boton boton-primario", id: "btn-cambiar-clave" }, "Cambiar contraseña");
  const formClave = h("form", { id: "formulario-clave", novalidate: true }, actual.contenedor, nueva.contenedor, avisoClave.elemento, notaClave.elemento, botonClave);
  formClave.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formClave);
    avisoClave.limpiar();
    notaClave.limpiar();
    try {
      await conCarga(botonClave, "Cambiando…", () => cambiarContrasena(actual.input.value, nueva.input.value));
      formClave.reset();
      notaClave.mostrar("Contraseña cambiada.");
    } catch (error) {
      // Contraseña actual incorrecta llega como 400 (D30), no como 401: no se pierde la sesión.
      if (!marcarCampoConError(formClave, error)) avisoClave.mostrar(error);
    }
  });

  // ---- eliminar ----
  const avisoBorrar = crearAviso();
  const botonBorrar = h("button", { type: "button", class: "boton boton-peligro", id: "btn-eliminar-cuenta" }, "Eliminar mi cuenta");
  botonBorrar.addEventListener("click", async () => {
    avisoBorrar.limpiar();
    const acepta = await confirmar("Se eliminará tu cuenta, tus plantas, su historial y tus invitaciones. Los invitados perderán el acceso. No se puede deshacer.", { aceptar: "Eliminar para siempre", peligro: true });
    if (!acepta) return;
    try {
      await conCarga(botonBorrar, "Eliminando…", () => eliminarCuenta());
      sesion.cerrar();
      toast("Tu cuenta fue eliminada.");
      ctx.irA("/");
    } catch (error) {
      avisoBorrar.mostrar(error);
    }
  });

  contenedor.append(
    h("section", { class: "tarjeta" },
      h("h2", { "data-titulo": "" }, "Mi perfil"),
      h("p", { class: "texto-suave" }, "Roles: ", cuenta.roles.map((rol) => (rol === "ADMINISTRADOR" ? "Administrador" : "Cliente")).join(", ")),
      formDatos,
    ),
    h("section", { class: "tarjeta" }, h("h2", {}, "Cambiar contraseña"), formClave),
    h("section", { class: "tarjeta zona-peligro" }, h("h2", {}, "Eliminar cuenta"), avisoBorrar.elemento, botonBorrar),
  );
}
