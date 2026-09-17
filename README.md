# Fitodiagnóstico — Front web

Cliente web del sistema de diagnóstico de plantas. HTML, CSS y JavaScript estáticos, sin framework ni build, que consumen la API del backend con peticiones asíncronas (`fetch` / `async await`). La página no se recarga al consultar un diagnóstico.

**Backend:** https://github.com/Pejelagarto-AI/arqui-fitodiagnostico-backend

## Por qué está en un repositorio aparte

El front es un cliente **independiente** de la API: se sirve desde otro origen y solo conoce el contrato HTTP. No importa código del backend ni el backend genera HTML para él. Vivir en su propio repositorio hace visible esa frontera.

## Estado

En construcción. Lo que va a tener:

- formulario con humedad del sustrato (%), luz (lux) y temperatura (°C)
- selector de especie poblado desde `GET /api/v1/especies`, no escrito a mano en el HTML
- consulta asíncrona a `POST /api/v1/diagnosticos` y presentación del diagnóstico
- manejo visible de los errores de la API

---

**Santiago Ortegón** · **Santiago Castellanos**

Arquitectura de Software · U. Sergio Arboleda · 2026-2
