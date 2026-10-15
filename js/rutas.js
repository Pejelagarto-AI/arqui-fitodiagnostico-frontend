// Funciones puras del enrutador por hash (sin DOM): se prueban con
// `node --test` (tests/rutas.test.mjs).

/** "#/plantas/abc?x=1" -> { ruta: "/plantas/abc", query: URLSearchParams }. */
export function parsearHash(hash) {
  const sinAlmohadilla = hash.startsWith("#") ? hash.slice(1) : hash;
  const [rutaCruda, ...restoQuery] = sinAlmohadilla.split("?");
  let ruta = rutaCruda || "/";
  if (!ruta.startsWith("/")) ruta = `/${ruta}`;
  if (ruta.length > 1 && ruta.endsWith("/")) ruta = ruta.slice(0, -1);
  return { ruta, query: new URLSearchParams(restoQuery.join("?")) };
}

function compilar(patron) {
  const nombres = [];
  const fuente = patron
    .split("/")
    .map((segmento) => {
      if (segmento.startsWith(":")) {
        nombres.push(segmento.slice(1));
        return "([^/]+)";
      }
      return segmento.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${fuente}$`), nombres };
}

/** Busca la entrada de la tabla que coincide; las literales ganan a las con parámetros. */
export function resolver(tabla, ruta) {
  const candidatas = [...tabla].sort(
    (a, b) => Number(a.patron.includes(":")) - Number(b.patron.includes(":")),
  );
  for (const entrada of candidatas) {
    const { regex, nombres } = compilar(entrada.patron);
    const coincidencia = regex.exec(ruta);
    if (coincidencia) {
      const params = {};
      nombres.forEach((nombre, i) => {
        params[nombre] = decodeURIComponent(coincidencia[i + 1]);
      });
      return { entrada, params };
    }
  }
  return null;
}
