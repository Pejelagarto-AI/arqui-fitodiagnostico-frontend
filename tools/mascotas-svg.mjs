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
// F49: la pose dormida (de noche, en los tres estados) y los 12 cuadros del saludo, en los mismos instantes que
// `noche_y_saludo()` de firmware/sprites/previsualizar.py: dormida a los 2500 ms (respiración abajo, tres zetas) y el
// saludo empezando a los 2500 ms, un cuadro cada 50 ms (se pinta a la mitad del cuadro, como la OLED a 20 fps).
const T_DORMIDA = 2500;
const T_SALUDO = 2500;
const svgDe = (m) => {
  m.nodo.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return { svg: serializar(m.nodo), cara: m.piezas() };
};
salida.noche = {};
salida.saludo = {};
for (const familia of FAMILIAS) {
  salida.noche[familia] = {};
  for (const estado of ESTADOS) {
    const m = crearMascota(familia, { estado, periodo: "NOCHE" });
    m.pintar(T_DORMIDA);
    salida.noche[familia][estado] = svgDe(m);
  }
  const m = crearMascota(familia, { estado: "SALUDABLE" });
  m.pintar(T_SALUDO);
  m.saludar();
  salida.saludo[familia] = [];
  for (let k = 0; k < 12; k++) {
    m.pintar(T_SALUDO + 50 * k);
    salida.saludo[familia].push(svgDe(m));
  }
}
process.stdout.write(JSON.stringify(salida));
