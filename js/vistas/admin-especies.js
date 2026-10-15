// RF-C1..C5: catálogo completo de especies (activas y desactivadas): crear,
// editar rangos, desactivar y reactivar. No hay DELETE (D27).
import { adminListarEspecies, adminCrearEspecie, adminEditarEspecie, adminDesactivarEspecie, adminReactivarEspecie } from "../api.js";
import { h, vaciar, campo, crearAviso, crearNota, conCarga, limpiarErroresDeFormulario, marcarCampoConError, toast } from "../ui.js";
import { camposDeRangos } from "../componentes/rangos.js";

export const titulo = "Especies";

const resumen = (r) => `${r.min}–${r.max} ${r.unidad}`;

export async function montar(contenedor, ctx) {
  const avisoLista = crearAviso();
  const avisoForm = crearAviso();
  const notaForm = crearNota();
  const lista = h("div", { id: "lista-especies" });
  let enEdicion = null; // nombre de la especie que se edita, o null si se crea

  const tituloForm = h("h2", { id: "titulo-form-especie" }, "Nueva especie");
  const nombre = campo({ id: "especie-nombre", nombre: "nombre", etiqueta: "Nombre", maxlength: "120", valor: ctx.query.get("nueva") || "" });
  const rangos = camposDeRangos("esp");
  const botonGuardar = h("button", { type: "submit", class: "boton boton-primario", id: "btn-guardar-especie" }, "Crear especie");
  const botonCancelar = h("button", { type: "button", class: "boton boton-secundario", id: "btn-cancelar-edicion", hidden: true }, "Cancelar edición");
  const formulario = h("form", { id: "formulario-especie", novalidate: true }, nombre.contenedor, rangos.nodo, avisoForm.elemento, notaForm.elemento, h("div", { class: "acciones" }, botonGuardar, botonCancelar));

  function modoCrear() {
    enEdicion = null;
    tituloForm.textContent = "Nueva especie";
    botonGuardar.textContent = "Crear especie";
    botonCancelar.hidden = true;
    nombre.input.readOnly = false;
    nombre.input.value = "";
    rangos.poner(null);
  }

  function modoEditar(especie) {
    enEdicion = especie.nombre;
    tituloForm.textContent = `Editar «${especie.nombre}»`;
    botonGuardar.textContent = "Guardar rangos";
    botonCancelar.hidden = false;
    nombre.input.readOnly = true; // el nombre es la clave y no se renombra (D33)
    nombre.input.value = especie.nombre;
    rangos.poner(especie.rangos);
    formulario.scrollIntoView({ block: "center" });
    nombre.input.focus();
  }

  botonCancelar.addEventListener("click", () => {
    limpiarErroresDeFormulario(formulario);
    avisoForm.limpiar();
    notaForm.limpiar();
    modoCrear();
  });

  async function alternar(especie) {
    avisoLista.limpiar();
    try {
      if (especie.activa) await adminDesactivarEspecie(especie.nombre);
      else await adminReactivarEspecie(especie.nombre);
      toast(`«${especie.nombre}» ${especie.activa ? "desactivada" : "reactivada"}.`);
      await cargar();
    } catch (error) {
      avisoLista.mostrar(error);
    }
  }

  async function cargar() {
    try {
      const especies = await adminListarEspecies();
      if (!ctx.vigente()) return;
      avisoLista.limpiar();
      vaciar(lista);
      lista.append(
        h("div", { class: "tabla-scroll" },
          h("table", { class: "tabla-parametros", id: "tabla-especies" },
            h("thead", {}, h("tr", {}, ["Especie", "Estado", "Humedad", "Luz", "Temperatura", ""].map((t) => h("th", { scope: "col" }, t)))),
            h("tbody", {}, especies.map((e) =>
              h("tr", { "data-especie": e.nombre },
                h("td", {}, e.nombre),
                h("td", {}, h("span", { class: `chip chip--${e.activa ? "optimo" : "bajo"}` }, e.activa ? "Activa" : "Desactivada")),
                h("td", {}, resumen(e.rangos.humedad)),
                h("td", {}, resumen(e.rangos.luz)),
                h("td", {}, resumen(e.rangos.temperatura)),
                h("td", { class: "celda-acciones" },
                  h("button", { type: "button", class: "boton boton-secundario boton-chico", "data-accion": "editar", onclick: () => modoEditar(e) }, "Editar"),
                  h("button", { type: "button", class: "boton boton-secundario boton-chico", "data-accion": e.activa ? "desactivar" : "reactivar", onclick: () => alternar(e) }, e.activa ? "Desactivar" : "Reactivar"),
                ),
              ))),
          ),
        ),
      );
    } catch (error) {
      if (ctx.vigente()) avisoLista.mostrar(error);
    }
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limpiarErroresDeFormulario(formulario);
    avisoForm.limpiar();
    notaForm.limpiar();
    try {
      const nombreEspecie = nombre.input.value.trim();
      await conCarga(botonGuardar, "Guardando…", () => (enEdicion ? adminEditarEspecie(enEdicion, rangos.valores()) : adminCrearEspecie(nombreEspecie, rangos.valores())));
      notaForm.mostrar(enEdicion ? `Rangos de «${enEdicion}» actualizados.` : `Especie «${nombreEspecie}» creada.`);
      modoCrear();
      await cargar();
    } catch (error) {
      if (!marcarCampoConError(formulario, error)) avisoForm.mostrar(error);
    }
  });

  contenedor.append(
    h("p", {}, h("a", { href: "#/admin" }, "← Administración")),
    h("section", { class: "tarjeta tarjeta--ancha" }, h("h2", { "data-titulo": "" }, "Especies"), avisoLista.elemento, lista),
    h("section", { class: "tarjeta tarjeta--ancha" }, tituloForm, formulario),
  );
  await cargar();
}
