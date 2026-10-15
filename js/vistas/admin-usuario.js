// RF-B2..B5: detalle de un usuario (con sus plantas), edición, eliminación y rol de administrador.
// 409 ULTIMO_ADMINISTRADOR: no se puede quitar/eliminar al único administrador (RN4).
import { adminObtenerUsuario, adminEditarUsuario, adminEliminarUsuario, adminOtorgarAdministrador, adminRevocarAdministrador, obtenerCuenta } from "../api.js";
import * as sesion from "../sesion.js";
import { h, vaciar, campo, crearAviso, crearNota, conCarga, confirmar, formatearFecha, limpiarErroresDeFormulario, marcarCampoConError, toast } from "../ui.js";

export const titulo = "Detalle de usuario";

export async function montar(contenedor, ctx) {
  const id = ctx.params.id;
  let usuario;
  try {
    usuario = await adminObtenerUsuario(id);
  } catch (error) {
    if (!ctx.vigente()) return;
    const aviso = crearAviso();
    aviso.mostrar(error);
    contenedor.append(h("section", { class: "tarjeta" }, h("h2", { "data-titulo": "" }, "Usuario no disponible"), aviso.elemento, h("p", {}, h("a", { href: "#/admin/usuarios" }, "Volver a usuarios"))));
    return;
  }
  if (!ctx.vigente()) return;

  const esYo = () => sesion.usuario() && sesion.usuario().id === usuario.id;
  const datos = h("div", { id: "datos-usuario" });
  const plantas = h("div", { id: "plantas-usuario" });
  const avisoAcciones = crearAviso();
  const encabezado = h("h2", { "data-titulo": "" });

  function pintarDatos() {
    encabezado.textContent = usuario.nombre;
    vaciar(datos);
    datos.append(
      h("p", {}, usuario.correo),
      h("p", { id: "roles-usuario" }, "Roles: ", usuario.roles.map((r) => (r === "ADMINISTRADOR" ? "Administrador" : "Cliente")).join(", ")),
    );
    vaciar(plantas);
    plantas.append(
      usuario.plantas.length === 0
        ? h("p", { class: "texto-vacio" }, "No tiene plantas.")
        : h("ul", { class: "lista-limpia" }, usuario.plantas.map((p) =>
            h("li", {}, h("strong", {}, p.apodo), ` · ${p.especie} · registrada ${formatearFecha(p.registradaEn)}`))),
    );
  }

  // ---- rol de administrador ----
  const botonRol = h("button", { type: "button", class: "boton boton-secundario", id: "btn-rol-admin" });
  function etiquetaDelRol() {
    botonRol.textContent = usuario.roles.includes("ADMINISTRADOR") ? "Quitar rol de administrador" : "Dar rol de administrador";
  }
  botonRol.addEventListener("click", async () => {
    avisoAcciones.limpiar();
    const esAdmin = usuario.roles.includes("ADMINISTRADOR");
    try {
      const actualizado = await conCarga(botonRol, "Guardando…", () => (esAdmin ? adminRevocarAdministrador(id) : adminOtorgarAdministrador(id)));
      usuario = { ...usuario, roles: actualizado.roles };
      pintarDatos();
      etiquetaDelRol();
      toast(esAdmin ? "Rol de administrador revocado." : "Rol de administrador otorgado.");
      // Si cambié mis propios roles, la sesión y el menú se ajustan (el rol se lee de la base en cada petición, D21).
      if (esYo()) {
        sesion.actualizarUsuario(await obtenerCuenta());
        if (!sesion.esAdmin()) ctx.irA("/plantas");
      }
    } catch (error) {
      avisoAcciones.mostrar(error);
    }
  });

  // ---- edición ----
  const avisoEditar = crearAviso();
  const notaEditar = crearNota();
  const nombre = campo({ id: "usuario-nombre", nombre: "nombre", etiqueta: "Nombre", valor: usuario.nombre, maxlength: "120" });
  const correo = campo({ id: "usuario-correo", nombre: "correo", etiqueta: "Correo", tipo: "email", valor: usuario.correo, maxlength: "254" });
  const botonGuardar = h("button", { type: "submit", class: "boton boton-primario", id: "btn-guardar-usuario" }, "Guardar cambios");
  const formulario = h("form", { id: "formulario-editar-usuario", novalidate: true }, nombre.contenedor, correo.contenedor, avisoEditar.elemento, notaEditar.elemento, botonGuardar);
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    avisoEditar.limpiar();
    notaEditar.limpiar();
    try {
      const editado = await conCarga(botonGuardar, "Guardando…", () => adminEditarUsuario(id, { nombre: nombre.input.value.trim(), correo: correo.input.value.trim() }));
      usuario = { ...usuario, nombre: editado.nombre, correo: editado.correo, roles: editado.roles };
      pintarDatos();
      if (esYo()) sesion.actualizarUsuario(editado);
      notaEditar.mostrar("Datos actualizados.");
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) avisoEditar.mostrar(error);
    }
  });

  // ---- eliminar ----
  const botonBorrar = h("button", { type: "button", class: "boton boton-peligro", id: "btn-eliminar-usuario" }, "Eliminar usuario");
  botonBorrar.addEventListener("click", async () => {
    avisoAcciones.limpiar();
    const acepta = await confirmar(`Se eliminará a ${usuario.nombre} con sus plantas, historial e invitaciones. No se puede deshacer.`, { aceptar: "Eliminar usuario", peligro: true });
    if (!acepta) return;
    try {
      await conCarga(botonBorrar, "Eliminando…", () => adminEliminarUsuario(id));
      toast(`Usuario ${usuario.nombre} eliminado.`);
      if (esYo()) {
        sesion.cerrar();
        ctx.irA("/");
      } else {
        ctx.irA("/admin/usuarios");
      }
    } catch (error) {
      avisoAcciones.mostrar(error);
    }
  });

  pintarDatos();
  etiquetaDelRol();
  contenedor.append(
    h("p", {}, h("a", { href: "#/admin/usuarios" }, "← Usuarios")),
    h("section", { class: "tarjeta" }, encabezado, datos, avisoAcciones.elemento, h("div", { class: "acciones" }, botonRol)),
    h("section", { class: "tarjeta" }, h("h2", {}, "Plantas"), plantas),
    h("section", { class: "tarjeta" }, h("h2", {}, "Editar datos"), formulario),
    h("section", { class: "tarjeta zona-peligro" }, h("h2", {}, "Eliminar"), botonBorrar),
  );
}
