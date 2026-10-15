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
node --test tests/stomp.test.mjs tests/rutas.test.mjs      # unitarias (codec STOMP y rutas), sin dependencias
cd tests/humo && npm install && node humo.mjs               # humo de punta a punta: backend + front levantados, Chrome headless
```

## Rutas (hash)

| Ruta | Acceso | Pantalla |
|---|---|---|
| `#/` | pública | diagnóstico suelto (RF-F6, el del corte 1) |
| `#/entrar`, `#/registro`, `#/recuperar` | sin sesión | iniciar sesión, crear cuenta, pedir enlace de recuperación |
| `#/restablecer?token=` | pública | elegir contraseña nueva (enlace del correo) |
| `#/invitacion?token=` | pública | aceptar invitación, con sesión o registrándose (enlace del correo) |
| `#/perfil` | sesión | datos, contraseña, eliminar cuenta |
| `#/plantas`, `#/plantas/nueva`, `#/plantas/{id}` | sesión | mis plantas y compartidas; registrar; detalle (vivo, historial, compartir, editar) |
| `#/solicitudes` | sesión | pedir una especie y ver mis solicitudes |
| `#/admin`, `#/admin/usuarios`, `#/admin/usuarios/{id}`, `#/admin/especies`, `#/admin/solicitudes` | admin | administración |

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `index.html` | cascarón: menú, `<main id="vista">`, CSP y `referrer` |
| `js/config.js` | `API_BASE` y `WS_URL`, sobreescribibles con `?api=` y `?ws=` |
| `js/api.js` | **único archivo que llama a `fetch`.** Una función por endpoint; normaliza todo error a `ErrorApi {codigo, mensaje, campo, status}`; maneja 204; adjunta el token (salvo en rutas públicas); un 401 con token vigente avisa a `app.js` |
| `js/envivo.js` | **único archivo que abre un WebSocket.** STOMP 1.2, suscripciones, reconexión con espera creciente, estado de la conexión |
| `js/stomp.js` | codec STOMP puro (sin red), con pruebas |
| `js/sesion.js` | token, caducidad y usuario en `sessionStorage`; único que toca el almacenamiento |
| `js/rutas.js`, `js/router.js` | parseo y resolución de rutas por hash (puro) / enrutador con guardas y carga perezosa de pantallas |
| `js/app.js` | tabla de rutas, menú, indicador en vivo, avisos globales, 401 |
| `js/ui.js` | helpers de DOM sin `innerHTML` (`h`), campos, avisos de error, toasts, confirmación, portapapeles |
| `js/vistas/*.js` | una pantalla por módulo: `export function montar(contenedor, ctx)` |
| `js/componentes/*.js` | piezas compartidas: diagnóstico, campos de medición, rangos, paneles del detalle de planta |
| `redireccion.js`, `invitacion/`, `restablecer/` | reenvío de los enlaces de camino del backend a las rutas hash |
| `css/estilos.css` | variables CSS, colores por estado, responsive y `prefers-reduced-motion` |
| `tests/` | pruebas unitarias y script de humo |

Decisiones y límites: [`docs/IMPLEMENTACION-CORTE2.md`](docs/IMPLEMENTACION-CORTE2.md).

---

**Santiago Ortegón** · **Santiago Castellanos**

Arquitectura de Software · U. Sergio Arboleda · 2026-2
