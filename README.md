# Fitodiagnóstico — Front web

Cliente web del sistema de diagnóstico de plantas: HTML, CSS y JavaScript estáticos, sin framework ni build. Consulta la API con `fetch`/`async-await`; la página no se recarga al pedir un diagnóstico.

**Backend:** https://github.com/Pejelagarto-AI/arqui-fitodiagnostico-backend · [documento de arquitectura](https://github.com/Pejelagarto-AI/arqui-fitodiagnostico-backend/blob/main/docs/ARQUITECTURA.md)

## Por qué está en un repositorio aparte

Este front es un cliente **independiente**: se sirve desde otro origen y solo conoce el contrato HTTP y el WebSocket del backend. No importa código del backend ni el backend genera HTML para él. Vivir en su propio repositorio hace visible esa frontera, y por eso el backend habilita CORS en vez de servir estos archivos.

## Cómo correrlo

1. Backend primero, en `http://localhost:8080` (ver su README). Desde el corte 2 exige variables de entorno. Para que los enlaces de los correos abran este front (que enruta por hash), `FITO_FRONT_URL` termina en `#`:

```bash
export FITO_JWT_SECRETO="$(openssl rand -base64 48)"
export FITO_ADMIN_CORREO=admin@fito.test FITO_ADMIN_CONTRASENA=admin-clave-larga
export FITO_FRONT_URL='http://localhost:5500/#'     # enlaces: http://localhost:5500/#/invitacion?token=...
./mvnw spring-boot:run
# opcional, correos de invitación y recuperación: docker run -d --rm --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
```

2. Front, con cualquier servidor estático:

```bash
python3 -m http.server 5500
```

3. Abrir `http://localhost:5500`. El backend ya trae `http://localhost:5500` y `http://127.0.0.1:5500` en CORS y en los orígenes permitidos del WebSocket.

**Enlaces de correo.** Con el `FITO_FRONT_URL` por defecto (`http://localhost:5500`) el backend arma `/invitacion?token=...` y `/restablecer?token=...`. Este front no necesita configuración del servidor para eso: `invitacion/index.html` y `restablecer/index.html` redirigen a `#/invitacion?token=...` y `#/restablecer?token=...`. Con `FITO_FRONT_URL=http://localhost:5500/#` el enlace ya es de hash y no hay redirección. Ambas formas funcionan.

### Apuntar a otra API

`js/config.js` toma la URL base de `?api=` (antes del hash) y el WebSocket de `?ws=` (si no, lo deduce: mismo servidor, ruta `/ws`):

```
http://localhost:5500/?api=http://localhost:9090/api/v1#/plantas
```

### Pruebas

```bash
node --test tests/*.test.mjs                                # unitarias (codec STOMP, rutas, sondeo, tiempos, escalas del diagnóstico y fechas relativas), sin dependencias
cd tests/humo && npm install && node humo.mjs               # humo de punta a punta: backend + front levantados, Chrome headless
```

## Sin red (demo offline)

La página no pide nada fuera de `'self'`: GSAP está en `js/vendor/` y Nunito en `css/fuentes/`, y la CSP de `index.html` no admite CDN ni Google Fonts. Con el backend y `python3 -m http.server 5500` locales, la demo corre sin internet. Con `prefers-reduced-motion` no hay animaciones y se ve el estado final.

## Diseño

Sistema visual «orgánico ilustrado» (F20, F21, F22): tema claro y oscuro automáticos, la planta en su matera cambia con la humedad, la luz y el estado, cada parámetro tiene su barra con la banda óptima y una minigráfica de las últimas lecturas, y «Mis plantas» es un tablero con el estado de cada una. La auditoría que lo originó vive en el repositorio de la entrega (`ux/AUDITORIA-UX.md`).

## Estado de la planta: sondeo (polling)

El detalle de una planta se actualiza solo: cada **5 s** (`INTERVALO_SONDEO_MS` en `js/sondeo.js`) pide `GET /plantas/{id}/diagnostico` (el vigente) y la página actual de `GET /plantas/{id}/diagnosticos` (el historial, con el origen MANUAL o DISPOSITIVO de cada registro). El indicador de la cabecera dice «actualizado hace Xs». Se detiene al salir de la pantalla y se pausa con la pestaña oculta. Si la API falla lo dice en pantalla (sin apilar avisos) y reintenta con espera creciente. El WebSocket ya no mueve el estado de la planta: queda solo para los avisos (toasts, acceso perdido). Detalle en F16 de [`docs/IMPLEMENTACION-CORTE2.md`](docs/IMPLEMENTACION-CORTE2.md).

## Vincular un dispositivo (reclamo por serial)

El humano no copia ninguna credencial. Cada dispositivo sale de fábrica con un **serial** impreso (`fito-7K2M9Q`) y un secreto guardado adentro. En el detalle de una planta propia, la sección **Dispositivos** pide el serial y llama a `POST /plantas/{id}/dispositivos` con `{serial}`. El dispositivo, por su cuenta, pide un reto, responde con un HMAC de su secreto y recibe su token. La lista de la sección dice «esperando que se conecte» o «conectado hace Xs» (se refresca con el sondeo de 5 s) y permite desvincular. Los diagnósticos que envíe aparecen en el historial con origen «Dispositivo». Detalle en F18 de [`docs/IMPLEMENTACION-CORTE2.md`](docs/IMPLEMENTACION-CORTE2.md).

El administrador registra los dispositivos en `#/admin/dispositivos` (F19): al registrar, el serial y el secreto se muestran **una sola vez** con botón de copiar y el comando listo del simulador. Requiere el backend de la fase 3.

## Rutas (hash)

| Ruta | Acceso | Pantalla |
|---|---|---|
| `#/` | pública | diagnóstico suelto (RF-F6, el del corte 1) |
| `#/entrar`, `#/registro`, `#/recuperar` | sin sesión | iniciar sesión, crear cuenta, pedir enlace de recuperación |
| `#/restablecer?token=` | pública | elegir contraseña nueva (enlace del correo) |
| `#/invitacion?token=` | pública | aceptar invitación, con sesión o registrándose (enlace del correo) |
| `#/perfil` | sesión | datos, contraseña, eliminar cuenta |
| `#/plantas`, `#/plantas/nueva`, `#/plantas/{id}` | sesión | mis plantas y compartidas; registrar; detalle (estado por sondeo, historial, dispositivos por serial, compartir, editar) |
| `#/solicitudes` | sesión | pedir una especie y ver mis solicitudes |
| `#/admin`, `#/admin/usuarios`, `#/admin/usuarios/{id}`, `#/admin/especies`, `#/admin/solicitudes`, `#/admin/dispositivos` | admin | administración; dispositivos de fábrica (serial y secreto) |

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `index.html` | cascarón: menú, `<main id="vista">`, CSP y `referrer` |
| `js/config.js` | `API_BASE` y `WS_URL`, sobreescribibles con `?api=` y `?ws=` |
| `js/api.js` | **único archivo que llama a `fetch`.** Una función por endpoint; normaliza todo error a `ErrorApi {codigo, mensaje, campo, status}`; maneja 204; adjunta el token (salvo en rutas públicas); un 401 con token vigente avisa a `app.js` |
| `js/envivo.js` | **único archivo que abre un WebSocket.** STOMP 1.2, suscripciones, reconexión con espera creciente, estado de la conexión. Solo para avisos (toasts, acceso perdido) |
| `js/tiempo.js` | «conectado hace Xs» y «esperando que se conecte» de los dispositivos; puro, con pruebas |
| `js/sondeo.js` | sondeo periódico (polling) con pausa por pestaña oculta y espera creciente ante errores; puro, con pruebas |
| `js/stomp.js` | codec STOMP puro (sin red), con pruebas |
| `js/sesion.js` | token, caducidad y usuario en `sessionStorage`; único que toca el almacenamiento |
| `js/rutas.js`, `js/router.js` | parseo y resolución de rutas por hash (puro) / enrutador con guardas y carga perezosa de pantallas |
| `js/app.js` | tabla de rutas, menú, indicador en vivo, avisos globales, 401 |
| `js/ui.js` | helpers de DOM sin `innerHTML` (`h`), campos, avisos de error, toasts, confirmación, portapapeles |
| `js/vistas/*.js` | una pantalla por módulo: `export function montar(contenedor, ctx)` |
| `js/componentes/*.js` | piezas compartidas: diagnóstico, campos de medición, rangos, paneles del detalle de planta |
| `redireccion.js`, `invitacion/`, `restablecer/` | reenvío de los enlaces de camino del backend a las rutas hash |
| `css/estilos.css` | sistema visual: tokens en `:root` (claro y oscuro por `prefers-color-scheme`), escala tipográfica, tarjetas, burbujas, historial como lista, responsive y `prefers-reduced-motion` (F20) |
| `css/fuentes.css`, `css/fuentes/` | Nunito vendorizada (`@font-face`, woff2 latin) |
| `js/vendor/gsap.min.js` | GSAP 3.12.5 vendorizado; script clásico antes de `app.js` |
| `js/animaciones.js` | envoltura de GSAP: entrada, barras, números, líneas, ilustración; no hace nada con reduced-motion |
| `js/componentes/ilustracion-planta.js`, `minigrafica.js`, `escala.js` | planta en matera SVG reactiva, minigráfica de tendencia y cálculos puros (F21) |
| `js/cache.js`, `js/deshacer.js`, `js/transiciones.js` | caché en memoria para stale-while-revalidate, petición retrasada tras «Deshacer», View Transitions (F25, F26, F28); puros salvo las transiciones, con pruebas |
| `tests/` | pruebas unitarias y script de humo |

Decisiones y límites: [`docs/IMPLEMENTACION-CORTE2.md`](docs/IMPLEMENTACION-CORTE2.md).

---

**Santiago Ortegón** · **Santiago Castellanos**

Arquitectura de Software · U. Sergio Arboleda · 2026-2
