# Corte 2: front web

Qué se construyó, dónde vive cada pieza, qué decisiones se tomaron (F1 en adelante, con la alternativa descartada), qué no cubre y preguntas de mutación. El backend tiene su propio documento (`docs/corte2/IMPLEMENTACION.md`, D20 en adelante); aquí se citan sus decisiones cuando condicionan al front.

## 1. Mapa de módulos

```
index.html ── js/app.js ──┬─ js/router.js ── js/rutas.js (puro)
 (CSP, menú)              │      └─ import() perezoso de cada pantalla:
                          │         js/vistas/*.js ── js/componentes/*.js
                          ├─ js/sesion.js   (token, sessionStorage)
                          ├─ js/envivo.js ── js/stomp.js (puro)   ← ÚNICO que abre WebSocket
                          └─ js/ui.js
js/api.js ← ÚNICO que llama a fetch (usa js/sesion.js y js/config.js)
```

| Requerimiento | Módulo |
|---|---|
| RF-F6 diagnóstico suelto | `vistas/diagnostico-suelto.js` |
| RF-A1..A8 cuentas y recuperación | `vistas/registro.js`, `entrar.js`, `perfil.js`, `recuperar.js`, `restablecer.js`; `sesion.js` |
| RF-D1..D5 plantas | `vistas/plantas.js`, `planta-nueva.js`, `planta-detalle.js`, `componentes/planta-edicion.js` |
| RF-F1, F4, F5 medir, vigente, historial | `componentes/planta-medicion.js`, `planta-vigente.js`, `planta-historial.js` |
| RF-E1..E6 compartir | `componentes/planta-compartir.js`, `vistas/invitacion.js`, botón de renunciar en `planta-detalle.js` |
| R6 estado de la planta por sondeo | `sondeo.js`; lo usa `planta-detalle.js` (ver F16) |
| RF-G3 avisos en vivo | `envivo.js`, suscripción global en `app.js` |
| Vincular dispositivo | `componentes/planta-dispositivos.js` (ver F17) |
| RF-H1, H2 solicitudes | `vistas/solicitudes.js` |
| RF-B, RF-C, RF-H3..H5 administración | `vistas/admin-*.js`, `componentes/rangos.js` |

Reglas del curso (RA2): cliente estático servido aparte, sin framework ni build, peticiones asíncronas sin recargar. Reglas propias vigiladas: `fetch` solo en `api.js`, `new WebSocket` solo en `envivo.js`, ningún `innerHTML` (todo dato de la API entra como texto).

## 2. Decisiones

**F1. El token vive en `sessionStorage`.** Sobrevive a F5, muere al cerrar la pestaña y no se comparte entre pestañas. Riesgo XSS: cualquier script de la página lo puede leer. Mitigaciones: ningún `innerHTML` con datos (helper `h()` solo crea nodos de texto), `Content-Security-Policy` en `index.html` sin scripts ni estilos en línea y sin `eval`, y expiración corta del backend (2 h, D20). Descartado: **memoria** (la opción más segura contra XSS persistente, pero F5 cierra la sesión y en una app con enlaces de correo y vista en vivo es muy incómodo); **`localStorage`** (misma exposición a XSS y además persiste días y se comparte entre pestañas: más superficie sin más beneficio aquí); **cookie `HttpOnly`** (exigiría cambiar el backend: D20 eligió bearer a propósito y el front vive en otro origen). Costo asumido: un XSS roba el token hasta que caduque (D22 ya lo dice del lado servidor).

**F2. Rutas por hash.** `#/plantas/{id}`. Un servidor estático (`python -m http.server`) solo sabe servir archivos: con rutas "limpias" un F5 en `/plantas/3` daría 404. Con el hash el servidor siempre ve `/`. Descartado: History API con `pushState` (exige reescritura a `index.html` en el servidor; el RA2 pide servirlo sin configuración).

**F3. Enlaces de correo: dos mecanismos, sin tocar el backend.** El backend arma `{FITO_FRONT_URL}/invitacion?token=` (`RutasDelFront`). (a) Con `FITO_FRONT_URL=http://host:5500/#` la concatenación da `http://host:5500/#/invitacion?token=...`, que es ruta hash. (b) Con el valor por defecto, `invitacion/index.html` y `restablecer/index.html` redirigen (`redireccion.js`) a la ruta hash conservando el `?token=`. Descartado: pedir un cambio en `RutasDelFront` (el backend no se toca) y un único mecanismo (el segundo hace que el despliegue por defecto funcione y el primero evita un salto).

**F4. WebSocket: STOMP mínimo propio sobre `WebSocket` nativo.** El protocolo que usa el backend es pequeño (CONNECT con `Authorization`, SUBSCRIBE, MESSAGE, ERROR; sin SockJS; sin envíos del cliente). `stomp.js` es un codec de ~60 líneas, con pruebas unitarias; `envivo.js` agrega suscripciones y reconexión. Descartado: `@stomp/stompjs` desde jsdelivr (dependencia externa, necesita CDN permitido en la CSP y red al abrir la página, y trae heartbeats, buffering y otros modos que no usamos). Costo: mantener el codec; no soporta heartbeats ni tramas con `content-length` binario (no hacen falta: el broker no las usa).

**F5. Una sola conexión por sesión, suscripciones por destino y reconexión con espera creciente.** `envivo.suscribir(destino, fn)` devuelve la baja; la conexión se abre al primer uso y se cierra al cerrar sesión. Si cae reintenta a 1, 2, 4… hasta 30 s; la espera se reinicia solo si la conexión aguantó 10 s (así un servidor que acepta y expulsa no se martilla). Al reconectar re-suscribe todo y avisa a las pantallas (`alReconectar`), que **vuelven a consultar**: el backend no reenvía lo perdido (broker en memoria, sin historial de mensajes). Un ERROR antes de CONNECTED (token inválido) no reintenta: el cliente comprueba la sesión con `GET /cuenta`, y si es 401 vuelve a iniciar sesión. Descartado: reconectar a intervalo fijo (martilla al servidor caído) y confiar en que no se pierda nada (falso).

**F6. (reemplazada por F16) El aviso en vivo dispara una consulta; no se pinta el mensaje.** `DIAGNOSTICO_NUEVO` solo trae el estado, no el detalle por parámetro, así que el front pide `GET /diagnostico` y la primera página del historial (un `debounce` de 120 ms junta `DIAGNOSTICO_NUEVO` y `CAMBIO_DE_ESTADO`, que llegan pegados). Ventaja: una sola ruta de pintado y la autorización sigue siendo la del GET. Descartado: reconstruir el diagnóstico desde el mensaje (duplicaría el contrato y los textos de recomendación).

**F7. Cada pantalla es un módulo con `montar(contenedor, ctx)` cargado con `import()`.** `ctx.vigente()` dice si el usuario sigue en esa pantalla; las pantallas lo consultan tras cada `await` para no pintar sobre otra. Devolver una función de limpieza (se llama al navegar) baja suscripciones y listeners. Descartado: un `app.js` con todo (el enunciado lo prohíbe y no se puede probar ni leer) y un framework.

**F8. Errores: un solo camino.** `api.js` convierte todo en `ErrorApi`. En pantalla: si el cuerpo trae `detalle.campo` y hay un campo con ese `name`, el mensaje sale junto al campo (`aria-invalid` + `aria-describedby`); si no, en una zona `role="alert"` de la pantalla. **401** con token enviado → `app.js` descarta la sesión y manda a `#/entrar?volver=<ruta>` con aviso (el login fallido NO cuenta: no se envía token). **403/404/409/410/415**: mensaje del cuerpo tal cual. La contraseña actual incorrecta llega como 400 (D30) y por eso no cierra la sesión. Descartado: tratar 401 y 403 igual (403 es "sin permiso", la sesión sigue buena).

**F9. Las rutas públicas no mandan el token.** Spring responde 401 a un token vencido aun en rutas `permitAll`; un visitante con sesión vieja no debe fallar al registrarse o diagnosticar. Por eso `api.js` distingue `publico: true`. Descartado: mandar siempre el token.

**F10. Registro e invitación sin token en la respuesta.** `POST /auth/registro` y `.../aceptar-con-registro` devuelven el usuario y no un token (D30). El front inicia sesión enseguida con las mismas credenciales (dos peticiones). Descartado: pedir al backend que devuelva token (no se toca) o mandar al usuario a iniciar sesión a mano.

**F11. El invitado no recibe los controles de modificar.** `planta.esDueno` decide qué paneles se crean (medir, compartir, editar, eliminar): no existen en el DOM. Es comodidad, no seguridad: el backend responde 403 (D36). Descartado: ocultarlos con CSS (siguen ahí y se pueden activar).

**F12. `GET /especies` se pide con `cache: "no-cache"`.** El backend lo sirve con `max-age=300` (límite documentado en su D del bloque 1). Sin esto, tras desactivar una especie el formulario de registrar planta la seguiría ofreciendo hasta 5 minutos. Descartado: añadir un parámetro de cache-busting (ensucia la URL y el contrato).

**F13. Confirmación con `<dialog>` propio, no `window.confirm`.** Accesible, con estilo y probable en pruebas. Se usa en eliminar cuenta/usuario/planta y en revocar invitaciones o accesos y renunciar.

**F14. El enlace de invitación se muestra una sola vez** (el backend solo entrega el token en esa respuesta) con botón de copiar (`navigator.clipboard`, con respaldo `execCommand`). Las listas de pendientes e invitados se recargan tras cada acción y también tras un error (p. ej. el enlace ya se aceptó), porque pudieron quedar viejas.

**F15. Aprobar una solicitud lleva a crear la especie.** El backend no da de alta la especie al aprobar (RF-H4 vs RF-C2): el front navega a `#/admin/especies?nueva=<nombre>` con el nombre puesto.

**F16. El estado de la planta se actualiza por sondeo (R6); el WebSocket queda solo para avisos.** `planta-detalle.js` usa `sondeo.js`: cada 5 s (`INTERVALO_SONDEO_MS`) pide `GET /plantas/{id}/diagnostico` (el vigente) y `GET /plantas/{id}/diagnosticos` (la página del historial que el usuario está mirando, sin saltar a la primera). Se detiene al salir de la pantalla y se pausa con la pestaña oculta (`visibilitychange`); al volver consulta de inmediato. Nunca hay dos consultas a la vez. Si falla, el indicador pasa a «sin conexión con el servidor, reintentando…», el aviso de la cabecera se reemplaza (no se apila, y no hay toasts) y se reintenta con espera creciente (10, 20, 30 s); 401/403/404 no se reintentan. Si no cambió nada no se repinta (se compara el id del diagnóstico y los del historial), así no parpadea ni se pierde el resaltado. El indicador dice «actualizado hace Xs». `ACCESO_PERDIDO` sigue llegando por el WebSocket de avisos. Descartado: mantener el WebSocket por planta y sondear de respaldo (dos caminos de pintado a mantener y a explicar) y sondear más rápido (carga innecesaria: un diagnóstico nuevo no necesita llegar en menos de 5 s). Costo: hasta 5 s de retraso al ver una medición de otro dispositivo, y 2 peticiones cada 5 s por pantalla abierta. `envivo.destinoDePlanta` queda sin uso en el front.

**F17. Vincular dispositivo: el token se muestra una vez.** Solo el dueño ve la sección (como F11). `POST /plantas/{id}/dispositivos` con `{dispositivoId}` devuelve `{dispositivoId, plantaId, token, expira}`; el token solo está en esa respuesta, así que se muestra con botón de copiar y la nota de que el simulador lo lee de `FITO_TOKEN_DISPOSITIVO`. No se guarda en el front. Los errores usan el mismo camino que F8 (junto al campo si el cuerpo nombra `dispositivoId`, si no en la zona de aviso). Los diagnósticos que lleguen por el dispositivo aparecen con origen «Dispositivo» en el vigente y en el historial.

## 3. Límites conocidos

- **No hay estado por planta en la lista.** `GET /plantas` no trae el diagnóstico; mostrarlo exigiría una consulta por planta (N+1) o un cambio del backend.
- **La lista de usuarios y la de plantas no están paginadas** (el backend no las pagina; con muchos usuarios la tabla crece). Solo el historial de diagnósticos es paginado.
- **El token vive en `sessionStorage`** (F1): un XSS lo roba. Y viaja en la cabecera `Authorization` del `CONNECT` de STOMP, igual que en la API.
- **El token de invitación y de restablecimiento van en la URL** (así los arma el backend): quedan en el historial del navegador. Mitigado con `Referrer-Policy: no-referrer` y por ser de un solo uso (y caducar).
- **La conexión en vivo no se re-autentica al caducar el token** (límite del backend, D59): sigue abierta hasta caer; la próxima petición HTTP da 401 y cierra la sesión.
- **Las pantallas no se refrescan solas con cambios ajenos que el backend no avisa** (p. ej. otro admin cambia un usuario): se ven al volver a cargar.
- **Los avisos se pierden si no hay conexión** (broker en memoria): al reconectar el detalle de planta se pone al día consultando, pero el aviso en sí (toast de `ACCESO_PERDIDO`, `SOLICITUD_RESUELTA`) no se repite. La lista de solicitudes y de plantas se actualiza al visitarla.
- **Los mensajes de validación del backend** son genéricos (`falta o es inválido el campo 'contrasena'`): por eso los formularios muestran las reglas (8 a 72 caracteres) como ayuda fija.
- **La prueba de humo evita la CSP** (Playwright evalúa con `eval`); un paso aparte la verifica sin bypass para el diagnóstico suelto y el login, no para todas las pantallas.
- **Sin pruebas unitarias de pantallas:** las pantallas se cubren con el humo (navegador real). Lo que es lógica pura (STOMP, rutas) sí tiene pruebas unitarias.
- **Maceta, QR y "medir ahora" (RF-F2)** quedan fuera: el backend aún no los ofrece.

## 4. Verificación

Detalle de qué se verificó y cómo en el reporte de la entrega y en `tests/humo/humo.mjs` (43 pasos: sesión, plantas, historial paginado, invitar, aceptar con registro y con sesión, vista en vivo sin recargar, caída y reconexión del WebSocket, quitar acceso, solicitudes, administración, perfil, 401, correo con Mailpit, redirecciones de enlaces, 375 px sin scroll horizontal).

## 5. Preguntas de mutación

**1. Si el backend cambia el WebSocket por SSE, ¿qué archivos del front cambian?**
`js/envivo.js` (abrir `EventSource` en vez de `WebSocket`, y como `EventSource` no manda cabeceras habría que pasar el token por query o usar `fetch` con streaming) y `js/stomp.js` (deja de usarse; se borra junto con `tests/stomp.test.mjs`). `config.js` solo si cambia la URL. Las pantallas no cambian: hablan con `suscribir(destino, fn)`, `alCambiarEstado` y `alReconectar`, que son la frontera. Ese es el motivo de F5: el transporte queda detrás de una interfaz de tres funciones. Habría que adaptar los nombres de destino si el SSE los expone distinto (`destinoDePlanta`, `DESTINO_AVISOS`, también en `envivo.js`).

**2. Si mañana hay una app móvil, ¿qué del backend se reusa?**
Todo: la API REST completa (cuentas, plantas, historial, compartir, solicitudes, administración) con el mismo JWT bearer, el WebSocket STOMP con el mismo `CONNECT` autenticado, y los códigos de error uniformes. El token bearer (D20) funciona igual en móvil sin CSRF ni cookies. Lo que no se reusa del front es la presentación: `ui.js`, `vistas/` y `componentes/` (DOM). Lo que se reescribe en el cliente móvil es la capa equivalente a `api.js` (una función por endpoint) y `envivo.js`; los enlaces de correo (`/invitacion?token=`) necesitarían enlaces universales/deep links, y eso sí toca `FITO_FRONT_URL`/`RutasDelFront` del backend.

**3. Si el backend empieza a devolver el token en una cookie `HttpOnly` en vez del cuerpo, ¿qué cambia en el front?**
`sesion.js` deja de guardar el token (solo el usuario y su expiración), `api.js` deja de poner `Authorization` y manda `credentials: "include"` (y el backend ajusta CORS con credenciales y CSRF). `envivo.js` ya no pone el token en el `CONNECT`: el navegador manda la cookie en el handshake, que hoy el backend ignora. Las pantallas no cambian, porque nunca tocan el token. Beneficio: un XSS ya no puede leerlo (F1 pasa a ser cuestión del backend); costo: CSRF y CORS con credenciales (D20).

**4. Si se agrega una pantalla nueva, ¿qué se toca?**
Un módulo en `js/vistas/` con `montar` y una línea en la tabla `RUTAS` de `app.js` (con su nivel de acceso). Nada más: el enrutador, las guardas, los errores y el 401 ya son comunes.
