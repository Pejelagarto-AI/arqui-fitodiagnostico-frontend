// Logica de interfaz. No llama a fetch directamente: todo pasa por api.js.
import { obtenerEspecies, diagnosticar } from "./api.js";

const selectEspecie = document.getElementById("especie-select");
const formulario = document.getElementById("formulario-diagnostico");
const btnDiagnosticar = document.getElementById("btn-diagnosticar");
const areaErrorEspecies = document.getElementById("area-error-especies");
const mensajeErrorEspecies = document.getElementById("mensaje-error-especies");
const btnReintentarEspecies = document.getElementById("btn-reintentar-especies");
const areaErrorGeneral = document.getElementById("area-error-general");
const mensajeErrorGeneral = document.getElementById("mensaje-error-general");

const resultadoVacio = document.getElementById("resultado-vacio");
const resultadoDiagnostico = document.getElementById("resultado-diagnostico");
const estadoGlobal = document.getElementById("estado-global");
const cuerpoTablaParametros = document.getElementById("cuerpo-tabla-parametros");
const listaRecomendaciones = document.getElementById("lista-recomendaciones");

const inputs = {
  especie: selectEspecie,
  humedad: document.getElementById("input-humedad"),
  luz: document.getElementById("input-luz"),
  temperatura: document.getElementById("input-temperatura"),
};

const erroresCampo = {
  especie: document.getElementById("error-especie"),
  humedad: document.getElementById("error-humedad"),
  luz: document.getElementById("error-luz"),
  temperatura: document.getElementById("error-temperatura"),
};

const rangos = {
  humedad: document.getElementById("rango-humedad"),
  luz: document.getElementById("rango-luz"),
  temperatura: document.getElementById("rango-temperatura"),
};

const ETIQUETAS_PARAMETRO = {
  humedad: "Humedad del sustrato",
  luz: "Luz",
  temperatura: "Temperatura",
};

const ETIQUETAS_ESTADO_PARAMETRO = {
  BAJO: "Bajo",
  OPTIMO: "Óptimo",
  ALTO: "Alto",
};

const ETIQUETAS_ESTADO_GLOBAL = {
  SALUDABLE: "Saludable",
  EN_RIESGO: "En riesgo",
  CRITICO: "Crítico",
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

function limpiarErrores() {
  areaErrorGeneral.hidden = true;
  mensajeErrorGeneral.textContent = "";
  for (const clave of Object.keys(inputs)) {
    inputs[clave].removeAttribute("aria-invalid");
    erroresCampo[clave].textContent = "";
  }
}

function mostrarError(error) {
  if (error.campo && erroresCampo[error.campo]) {
    inputs[error.campo].setAttribute("aria-invalid", "true");
    inputs[error.campo].focus();
    erroresCampo[error.campo].textContent = error.mensaje;
    return;
  }
  mensajeErrorGeneral.textContent = error.mensaje;
  areaErrorGeneral.hidden = false;
}

function crearChipEstado(estado) {
  const chip = document.createElement("span");
  chip.className = `chip chip--${estado.toLowerCase()}`;
  chip.textContent = ETIQUETAS_ESTADO_PARAMETRO[estado] || estado;
  return chip;
}

function pintarResultado(diagnostico) {
  resultadoVacio.hidden = true;
  resultadoDiagnostico.hidden = false;

  estadoGlobal.textContent = ETIQUETAS_ESTADO_GLOBAL[diagnostico.estado] || diagnostico.estado;
  estadoGlobal.className = `estado-global ${diagnostico.estado.toLowerCase()}`;

  cuerpoTablaParametros.innerHTML = "";
  for (const parametro of diagnostico.parametros) {
    const fila = document.createElement("tr");

    const celdaNombre = document.createElement("td");
    celdaNombre.textContent = ETIQUETAS_PARAMETRO[parametro.nombre] || parametro.nombre;

    const celdaValor = document.createElement("td");
    celdaValor.textContent = `${parametro.valor} ${parametro.unidad}`;

    const celdaRango = document.createElement("td");
    const [min, max] = parametro.rangoOptimo;
    celdaRango.textContent = `${min}–${max} ${parametro.unidad}`;

    const celdaEstado = document.createElement("td");
    celdaEstado.appendChild(crearChipEstado(parametro.estado));

    fila.append(celdaNombre, celdaValor, celdaRango, celdaEstado);
    cuerpoTablaParametros.appendChild(fila);
  }

  listaRecomendaciones.innerHTML = "";
  if (diagnostico.recomendaciones && diagnostico.recomendaciones.length > 0) {
    for (const recomendacion of diagnostico.recomendaciones) {
      const item = document.createElement("li");
      item.textContent = recomendacion;
      listaRecomendaciones.appendChild(item);
    }
  } else {
    const item = document.createElement("li");
    item.textContent = "Sin recomendaciones: todos los parámetros están en rango.";
    listaRecomendaciones.appendChild(item);
  }
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limpiarErrores();

  const medicion = {
    especie: selectEspecie.value,
    humedad: parseFloat(inputs.humedad.value),
    luz: parseFloat(inputs.luz.value),
    temperatura: parseFloat(inputs.temperatura.value),
  };

  btnDiagnosticar.disabled = true;
  btnDiagnosticar.textContent = "Consultando…";
  try {
    const diagnostico = await diagnosticar(medicion);
    pintarResultado(diagnostico);
  } catch (error) {
    mostrarError(error);
  } finally {
    btnDiagnosticar.disabled = false;
    btnDiagnosticar.textContent = "Diagnosticar";
  }
});

cargarEspecies();
