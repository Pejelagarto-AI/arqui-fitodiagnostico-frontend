// RF-B1: listar y buscar usuarios (por nombre o correo, `?q=`).
import { adminListarUsuarios } from "../api.js";
import { h, vaciar, campo, crearAviso } from "../ui.js";

export const titulo = "Usuarios";

export async function montar(contenedor, ctx) {
  const aviso = crearAviso();
  const resultados = h("div", { id: "resultados-usuarios" });
  const busqueda = campo({ id: "buscar-usuarios", nombre: "q", etiqueta: "Buscar por nombre o correo", tipo: "search", requerido: false, valor: ctx.query.get("q") || "" });
  const formulario = h("form", { id: "formulario-buscar", class: "formulario-en-linea", role: "search" }, busqueda.contenedor, h("button", { type: "submit", class: "boton boton-primario", id: "btn-buscar" }, "Buscar"));

  async function buscar() {
    try {
      const usuarios = await adminListarUsuarios(busqueda.input.value.trim());
      if (!ctx.vigente()) return;
      aviso.limpiar();
      vaciar(resultados);
      if (usuarios.length === 0) {
        resultados.append(h("p", { class: "texto-vacio" }, "Ningún usuario coincide."));
        return;
      }
      resultados.append(
        h("div", { class: "tabla-scroll" },
          h("table", { class: "tabla-parametros", id: "tabla-usuarios" },
            h("thead", {}, h("tr", {}, ["Nombre", "Correo", "Roles", ""].map((t) => h("th", { scope: "col" }, t)))),
            h("tbody", {}, usuarios.map((u) =>
              h("tr", {},
                h("td", {}, u.nombre),
                h("td", {}, u.correo),
                h("td", {}, u.roles.includes("ADMINISTRADOR") ? h("span", { class: "chip chip--alto" }, "Administrador") : "Cliente"),
                h("td", {}, h("a", { href: `#/admin/usuarios/${u.id}` }, "Ver detalle")),
              ))),
          ),
        ),
        h("p", { class: "texto-suave" }, `${usuarios.length} usuario${usuarios.length === 1 ? "" : "s"}`),
      );
    } catch (error) {
      if (ctx.vigente()) aviso.mostrar(error);
    }
  }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    buscar();
  });

  contenedor.append(
    h("p", {}, h("a", { href: "#/admin" }, "← Administración")),
    h("section", { class: "tarjeta tarjeta--ancha" }, h("h2", { "data-titulo": "" }, "Usuarios"), formulario, aviso.elemento, resultados),
  );
  await buscar();
}
