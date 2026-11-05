// Guion de la escena viva de la portada (F38): lógica pura, sin DOM (tests/portada.test.mjs).
// La planta «habla»: cada momento trae su estado, lo que dice y lo que marcan los tres sensores. La portada
// los recorre en bucle; así quien llega entiende sin leer nada más que la matera mide y la planta avisa.

/** Cuánto dura cada momento en pantalla. */
export const DURACION_MOMENTO_MS = 3800;

/**
 * planta: "comun" | "carnivora". estado: el del diagnóstico (mueve hojas y color). humedad y luz: 0 a 100,
 * mueven el agua de la matera y el sol. alerta: el sensor que pide atención ("agua" | "luz" | null).
 */
export const MOMENTOS = [
  { planta: "comun", estado: "SALUDABLE", humedad: 62, luz: 70, frase: "Estoy bien. Hoy no necesito nada.", valores: { agua: "62 %", luz: "850 lux", temperatura: "23 °C" }, alerta: null },
  { planta: "comun", estado: "EN_RIESGO", humedad: 16, luz: 70, frase: "Tengo sed. Riégame un poco.", valores: { agua: "16 %", luz: "850 lux", temperatura: "24 °C" }, alerta: "agua" },
  { planta: "comun", estado: "SALUDABLE", humedad: 68, luz: 70, frase: "Gracias. Ya me siento mejor.", valores: { agua: "68 %", luz: "850 lux", temperatura: "23 °C" }, alerta: null },
  { planta: "carnivora", estado: "SALUDABLE", humedad: 80, luz: 92, frase: "Soy carnívora: me encanta el sol.", valores: { agua: "80 %", luz: "12000 lux", temperatura: "26 °C" }, alerta: null, muerde: true },
  { planta: "carnivora", estado: "EN_RIESGO", humedad: 78, luz: 10, frase: "Me falta luz. Llévame a la ventana.", valores: { agua: "78 %", luz: "900 lux", temperatura: "25 °C" }, alerta: "luz" },
];

/** El momento que sigue, en bucle. */
export function siguienteMomento(indice, total = MOMENTOS.length) {
  return total > 0 ? (indice + 1) % total : 0;
}

/** Los tres pasos de «Así funciona». */
export const PASOS = [
  { icono: "conecta", titulo: "Conecta la matera", texto: "Enciéndela y escribe el código que muestra su pantalla." },
  { icono: "mira", titulo: "Mira cómo está", texto: "Agua, luz y temperatura, al día, en tu celular." },
  { icono: "haz", titulo: "Haz lo que te pide", texto: "Riégala o muévela a la luz: te decimos qué y cuándo." },
];
