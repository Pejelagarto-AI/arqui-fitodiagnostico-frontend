// Menú de la administración (solo rol ADMINISTRADOR; el backend lo exige además, D21).
import { h } from "../ui.js";

export const titulo = "Administración";

export function montar(contenedor) {
  const tarjeta = (ruta, nombre, texto) =>
    h("li", { class: "planta-item" }, h("a", { href: `#${ruta}`, class: "planta-enlace" }, h("strong", {}, nombre), h("span", { class: "texto-suave" }, texto)));
  contenedor.append(
    h("section", { class: "tarjeta" },
      h("h2", { "data-titulo": "" }, "Administración"),
      h("ul", { class: "rejilla" },
        tarjeta("/admin/usuarios", "Usuarios", "Buscar, editar, eliminar y dar o quitar el rol de administrador."),
        tarjeta("/admin/especies", "Especies", "Catálogo completo: crear, editar rangos, desactivar y reactivar."),
        tarjeta("/admin/solicitudes", "Solicitudes de especie", "Aprobar o rechazar lo que piden los clientes."),
      ),
    ),
  );
}
