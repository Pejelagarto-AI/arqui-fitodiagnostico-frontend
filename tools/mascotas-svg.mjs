// Vuelca las mascotas del front como SVG estático (en reposo, un cuadro por pose) y las piezas de su cara, en JSON, para
// que `tools/comparar-mascotas.py` las ponga junto a los sprites de la OLED. Sin navegador: usa el DOM mínimo de
// tests/dom-minimo.mjs.   Uso: node tools/mascotas-svg.mjs > mascotas.json
import { instalarDom, serializar } from "../tests/dom-minimo.mjs";

instalarDom();
const { crearMascota } = await import("../js/componentes/mascota.js");
const { FAMILIAS } = await import("../js/componentes/especie.js");

const ESTADOS = ["SALUDABLE", "EN_RIESGO", "CRITICO"];
// cuadros de idle que se comparan: [estado, cuadro]; el resto de los estados tiene uno solo salvo el helecho (dos)
const CUADROS = {
  girasol: { SALUDABLE: [0, 1] },
  suculenta: { SALUDABLE: [0, 1] },
  helecho: { SALUDABLE: [0, 1], EN_RIESGO: [0, 1], CRITICO: [0, 1] },
  carnivora: { SALUDABLE: [0, 1, 2] },
};

const salida = {};
for (const familia of FAMILIAS) {
  salida[familia] = {};
  for (const estado of ESTADOS) {
    for (const cuadro of CUADROS[familia]?.[estado] ?? [0]) {
      const m = crearMascota(familia, { estado });
      m.pintar(0, { reposo: true, cuadro });
      m.nodo.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      salida[familia][`${estado}#${cuadro}`] = { svg: serializar(m.nodo), cara: m.piezas() };
    }
  }
}
process.stdout.write(JSON.stringify(salida));
