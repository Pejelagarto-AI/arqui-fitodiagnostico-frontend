// DOM mínimo para probar y dibujar las mascotas con Node (sin navegador): lo justo que usan `svg()` de ui.js y
// `crearMascota`. Un elemento guarda atributos e hijos y se serializa a SVG con `serializar()`.
class Nodo {}

class Texto extends Nodo {
  constructor(texto) {
    super();
    this.texto = String(texto);
  }
}

class Elemento extends Nodo {
  constructor(etiqueta) {
    super();
    this.etiqueta = etiqueta;
    this.atributos = new Map();
    this.hijos = [];
    this.isConnected = false;
    this.dataset = new Proxy({}, {
      set: (_, clave, valor) => {
        this.atributos.set(`data-${clave.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`)}`, String(valor));
        return true;
      },
      get: (_, clave) => this.atributos.get(`data-${clave.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`)}`),
    });
  }

  setAttribute(clave, valor) { this.atributos.set(clave, String(valor)); }
  getAttribute(clave) { return this.atributos.has(clave) ? this.atributos.get(clave) : null; }
  hasAttribute(clave) { return this.atributos.has(clave); }
  removeAttribute(clave) { this.atributos.delete(clave); }
  append(...hijos) { this.hijos.push(...hijos); }
  replaceChildren(...hijos) { this.hijos = [...hijos]; }
  addEventListener(tipo, f) { (this.oyentes ??= {})[tipo] = [...(this.oyentes[tipo] ?? []), f]; }
  /** Dispara los oyentes de `tipo` con un evento mínimo (preventDefault y stopPropagation se anotan). */
  disparar(tipo, datos = {}) {
    const evento = { ...datos, tipo, impedido: false, detenido: false, preventDefault() { this.impedido = true; }, stopPropagation() { this.detenido = true; } };
    for (const f of this.oyentes?.[tipo] ?? []) f(evento);
    return evento;
  }
  set className(valor) { this.atributos.set("class", valor); }
  get className() { return this.atributos.get("class") ?? ""; }
  /** Descendientes (y él mismo) que cumplen `pred`. */
  buscar(pred, lista = []) {
    if (pred(this)) lista.push(this);
    for (const h of this.hijos) if (h instanceof Elemento) h.buscar(pred, lista);
    return lista;
  }
}

export function instalarDom() {
  globalThis.Node = Nodo;
  globalThis.document = {
    createElementNS: (_, etiqueta) => new Elemento(etiqueta),
    createElement: (etiqueta) => new Elemento(etiqueta),
    createTextNode: (texto) => new Texto(texto),
  };
}

const escapar = (t) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** SVG como texto. `extraAtributos` se agrega a la raíz (p. ej. x, y, width, height para anidarlo). */
export function serializar(nodo, extraAtributos = {}) {
  if (nodo instanceof Texto) return nodo.texto;
  const atributos = new Map([...nodo.atributos, ...Object.entries(extraAtributos)]);
  const attrs = [...atributos].map(([k, v]) => ` ${k}="${escapar(String(v))}"`).join("");
  const hijos = nodo.hijos.map((h) => serializar(h)).join("");
  return hijos ? `<${nodo.etiqueta}${attrs}>${hijos}</${nodo.etiqueta}>` : `<${nodo.etiqueta}${attrs}/>`;
}

export { Elemento };
