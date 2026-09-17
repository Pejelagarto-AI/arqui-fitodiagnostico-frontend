# Fitodiagnóstico — Front web

Cliente web del sistema de diagnóstico de plantas: HTML, CSS y JavaScript estáticos, sin framework ni build. Consulta la API con `fetch`/`async-await`; la página no se recarga al pedir un diagnóstico.

**Backend:** https://github.com/Pejelagarto-AI/arqui-fitodiagnostico-backend · [documento de arquitectura](https://github.com/Pejelagarto-AI/arqui-fitodiagnostico-backend/blob/main/docs/ARQUITECTURA.md)

## Por qué está en un repositorio aparte

Este front es un cliente **independiente**: se sirve desde otro origen y solo conoce el contrato HTTP del backend (`GET /api/v1/especies`, `POST /api/v1/diagnosticos`). No importa código del backend ni el backend genera HTML para él. Vivir en su propio repositorio hace visible esa frontera, y por eso el backend habilita CORS en vez de servir estos archivos.

## Cómo correrlo

1. Backend primero, en `http://localhost:8080` (ver su README).
2. Front, servido con cualquier servidor estático — por ejemplo:

```bash
python3 -m http.server 5500
```

3. Abrir `http://localhost:5500`. El backend ya trae `http://localhost:5500` y `http://127.0.0.1:5500` habilitados en CORS por defecto.

### Apuntar a otra API

`js/config.js` toma la URL base de `?api=`, sin tocar código:

```
http://localhost:5500/?api=http://localhost:9090/api/v1
```

Sin el query param, usa `http://localhost:8080/api/v1`.

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `index.html` | formulario de medición (especie, humedad, luz, temperatura) y las zonas de resultado/error |
| `js/config.js` | única fuente de la URL base de la API (`API_BASE`), sobreescribible con `?api=` |
| `js/api.js` | **único archivo que llama a `fetch`.** Envuelve `GET /especies` y `POST /diagnosticos`, y normaliza cualquier falla (red, HTTP 4xx/5xx, cuerpo no-JSON) a un `ErrorApi` con `{codigo, mensaje, campo, status}` |
| `js/app.js` | lógica de interfaz: puebla el selector de especies, pinta rangos óptimos, maneja el submit del formulario y pinta resultado o error. No llama a `fetch` directamente — todo pasa por `api.js` |
| `css/estilos.css` | estilos con variables CSS, colores semánticos por estado (saludable/en riesgo/crítico, bajo/óptimo/alto) y soporte `prefers-reduced-motion` |

---

**Santiago Ortegón** · **Santiago Castellanos**

Arquitectura de Software · U. Sergio Arboleda · 2026-2
