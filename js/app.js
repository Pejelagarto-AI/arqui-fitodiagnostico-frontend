// Logica de interfaz. No llama a fetch directamente: todo pasa por api.js.
import { obtenerEspecies } from "./api.js";

const selectEspecie = document.getElementById("especie-select");
const formulario = document.getElementById("formulario-diagnostico");
const areaErrorEspecies = document.getElementById("area-error-especies");
const mensajeErrorEspecies = document.getElementById("mensaje-error-especies");
const btnReintentarEspecies = document.getElementById("btn-reintentar-especies");

const inputs = {
  humedad: document.getElementById("input-humedad"),
  luz: document.getElementById("input-luz"),
  temperatura: document.getElementById("input-temperatura"),
};

const rangos = {
  humedad: document.getElementById("rango-humedad"),
  luz: document.getElementById("rango-luz"),
  temperatura: document.getElementById("rango-temperatura"),
};

// nombre de especie -> rangos que devolvio la API, para pintar el rango
// optimo de cada parametro sin volver a pedirle nada al backend.
let especiesPorNombre = new Map();

function formatearRango(rango) {
  if (!rango) return "";
  const { min, max, unidad } = rango;
  return `Optimo: ${min}–${max} ${unidad}`;
}

function limpiarSelectEspecies(textoOpcion) {
  selectEspecie.innerHTML = "";
  const opcion = document.createElement("option");
  opcion.value = "";
  opcion.disabled = true;
  opcion.selected = true;
  opcion.textContent = textoOpcion;
  selectEspecie.appendChild(opcion);
}

function poblarSelectEspecies(especies) {
  selectEspecie.innerHTML = "";
  especiesPorNombre = new Map(especies.map((especie) => [especie.nombre, especie.rangos]));

  const opcionInicial = document.createElement("option");
  opcionInicial.value = "";
  opcionInicial.selected = true;
  opcionInicial.textContent = "Selecciona una especie";
  selectEspecie.appendChild(opcionInicial);

  for (const especie of especies) {
    const opcion = document.createElement("option");
    opcion.value = especie.nombre;
    opcion.textContent = especie.nombre;
    selectEspecie.appendChild(opcion);
  }

  selectEspecie.disabled = false;
}

function mostrarRangosDeEspecie(nombreEspecie) {
  const rangosEspecie = especiesPorNombre.get(nombreEspecie);
  for (const clave of Object.keys(rangos)) {
    rangos[clave].textContent = rangosEspecie ? formatearRango(rangosEspecie[clave]) : "";
  }
}

async function cargarEspecies() {
  areaErrorEspecies.hidden = true;
  selectEspecie.disabled = true;
  limpiarSelectEspecies("Cargando especies…");

  try {
    const especies = await obtenerEspecies();
    poblarSelectEspecies(especies);
  } catch (error) {
    limpiarSelectEspecies("No se pudieron cargar las especies");
    mensajeErrorEspecies.textContent = error.mensaje;
    areaErrorEspecies.hidden = false;
  }
}

selectEspecie.addEventListener("change", (evento) => {
  mostrarRangosDeEspecie(evento.target.value);
});

btnReintentarEspecies.addEventListener("click", () => {
  cargarEspecies();
});

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();
  // El envio del diagnostico se conecta en el siguiente incremento.
});

cargarEspecies();
