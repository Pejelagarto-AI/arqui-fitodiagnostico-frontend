// RF-E2: aceptar una invitación desde el enlace (#/invitacion?token=...).
//  - Con sesión: un botón y listo.
//  - Sin sesión: o inicia sesión y vuelve aquí, o se registra y acepta en un
//    solo paso (POST /invitaciones/aceptar-con-registro, público).
// Errores del enlace: 404 no existe, 410 ya se usó / caducó / se revocó.
import { aceptarInvitacion, aceptarInvitacionConRegistro, iniciarSesion } from "../api.js";
import * as sesion from "../sesion.js";
import { h, campo, crearAviso, conCarga, limpiarErroresDeFormulario, marcarCampoConError, toast } from "../ui.js";
import { rutaActual } from "../router.js";

export const titulo = "Invitación a una planta";

export function montar(contenedor, ctx) {
  const token = ctx.query.get("token");
  const aviso = crearAviso();
  const tarjeta = h("section", { class: "tarjeta tarjeta--angosta" }, h("h2", { "data-titulo": "" }, "Invitación a una planta"));
  contenedor.append(tarjeta);

  if (!token) {
    aviso.mostrar("El enlace está incompleto: falta el token de la invitación.");
    tarjeta.append(aviso.elemento, h("p", {}, h("a", { href: "#/" }, "Ir al inicio")));
    return;
  }

  tarjeta.append(
    h("p", {}, "Te compartieron una planta. Al aceptar podrás ver su diagnóstico y su historial en solo lectura, y recibirás avisos de cambios."),
    aviso.elemento,
  );

  if (sesion.haySesion()) {
    const boton = h("button", { type: "button", class: "boton boton-primario", id: "btn-aceptar-invitacion" }, "Aceptar invitación");
    boton.addEventListener("click", async () => {
      aviso.limpiar();
      try {
        const planta = await conCarga(boton, "Aceptando…", () => aceptarInvitacion(token));
        toast(`Ahora ves la planta «${planta.apodo}».`);
        ctx.irA(`/plantas/${planta.id}`);
      } catch (error) {
        aviso.mostrar(error);
      }
    });
    tarjeta.append(h("p", { class: "texto-suave" }, `Sesión iniciada como ${sesion.usuario().nombre}.`), boton);
    return;
  }

  // Sin sesión.
  const aviso2 = crearAviso();
  const nombre = campo({ id: "inv-nombre", nombre: "nombre", etiqueta: "Nombre", autocomplete: "name", maxlength: "120" });
  const correo = campo({ id: "inv-correo", nombre: "correo", etiqueta: "Correo", tipo: "email", autocomplete: "email", maxlength: "254" });
  const contrasena = campo({ id: "inv-contrasena", nombre: "contrasena", etiqueta: "Contraseña", tipo: "password", autocomplete: "new-password", minlength: "8", maxlength: "72", ayuda: "Entre 8 y 72 caracteres." });
  const boton = h("button", { type: "submit", class: "boton boton-primario", id: "btn-aceptar-registro" }, "Crear cuenta y aceptar");

  const formulario = h("form", { id: "formulario-invitacion", novalidate: true }, nombre.contenedor, correo.contenedor, contrasena.contenedor, aviso2.elemento, boton);
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    aviso2.limpiar();
    aviso.limpiar();
    try {
      const planta = await conCarga(boton, "Creando cuenta…", async () => {
        const datos = { token, nombre: nombre.input.value.trim(), correo: correo.input.value.trim(), contrasena: contrasena.input.value };
        const respuesta = await aceptarInvitacionConRegistro(datos);
        // El backend no entrega token al registrar: se inicia sesión con las mismas credenciales.
        sesion.iniciar(await iniciarSesion(datos.correo, datos.contrasena));
        return respuesta.planta;
      });
      toast(`Cuenta creada. Ahora ves la planta «${planta.apodo}».`);
      ctx.irA(`/plantas/${planta.id}`);
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) aviso2.mostrar(error);
    }
  });

  const volver = encodeURIComponent(rutaActual());
  tarjeta.append(
    h("h3", {}, "¿Ya tienes cuenta?"),
    h("p", {}, h("a", { href: `#/entrar?volver=${volver}`, class: "boton boton-secundario", id: "enlace-entrar-invitacion" }, "Inicia sesión para aceptar")),
    h("h3", {}, "¿Eres nuevo? Crea tu cuenta"),
    formulario,
  );
}
