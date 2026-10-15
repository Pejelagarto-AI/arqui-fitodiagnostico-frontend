// RF-D2 y RF-E4: mis plantas y las compartidas conmigo.
import { listarPlantas, listarPlantasCompartidas } from "../api.js";
import { h, vaciar, crearAviso, formatearFecha } from "../ui.js";

export const titulo = "Mis plantas";

function tarjetaDePlanta(planta) {
  return h("li", { class: "planta-item" },
    h("a", { href: `#/plantas/${planta.id}`, class: "planta-enlace" },
      h("strong", {}, planta.apodo),
      h("span", { class: "texto-suave" }, planta.especie),
      h("span", { class: "texto-suave" }, `Registrada ${formatearFecha(planta.registradaEn)}`),
    ),
  );
}

function listaDe(plantas, vacio) {
  if (plantas.length === 0) return h("p", { class: "texto-vacio" }, vacio);
  return h("ul", { class: "rejilla" }, plantas.map(tarjetaDePlanta));
}

export async function montar(contenedor, ctx) {
  const aviso = crearAviso();
  const propias = h("div", { id: "lista-propias" });
  const compartidas = h("div", { id: "lista-compartidas" });

  contenedor.append(
    h("section", { class: "tarjeta" },
      h("div", { class: "encabezado-seccion" },
        h("h2", { "data-titulo": "" }, "Mis plantas"),
        h("a", { href: "#/plantas/nueva", class: "boton boton-primario", id: "enlace-nueva-planta" }, "Registrar planta"),
      ),
      aviso.elemento,
      propias,
    ),
    h("section", { class: "tarjeta" },
      h("h2", {}, "Compartidas conmigo"),
      h("p", { class: "texto-suave" }, "Plantas de otras personas que puedes ver en solo lectura."),
      compartidas,
    ),
  );

  async function cargar() {
    try {
      const [mias, ajenas] = await Promise.all([listarPlantas(), listarPlantasCompartidas()]);
      if (!ctx.vigente()) return;
      aviso.limpiar();
      vaciar(propias);
      vaciar(compartidas);
      propias.append(listaDe(mias, "Todavía no registraste ninguna planta."));
      compartidas.append(listaDe(ajenas, "Nadie te ha compartido plantas todavía."));
    } catch (error) {
      if (ctx.vigente()) aviso.mostrar(error);
    }
  }
  await cargar();

  // Si pierdo el acceso a una compartida (aviso en vivo), la lista se pone al día sola.
  const alAviso = (evento) => {
    if (evento.detail.tipo === "ACCESO_PERDIDO") cargar();
  };
  window.addEventListener("fito:aviso", alAviso);
  return () => window.removeEventListener("fito:aviso", alAviso);
}
