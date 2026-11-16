# Cómo correr el humo en esta máquina

El humo (`tests/humo/humo.mjs`) abre el front y un backend reales en Chrome headless. Aquí no hay Mailpit ni Docker, y las demos viven en 5500, 8080 y 8443, así que todo va en puertos alternos y no toca esas.

## 1. Backend (8090, H2 en memoria)

Jar: el de `target/` del backend puede ir atrás de `develop`. Para uno al día, en un worktree del backend sobre `origin/develop`: `MAVEN_OPTS=-Xmx512m ./mvnw -q -DskipTests package` (un solo Maven a la vez; mira `free -m`).

```
SERVER_PORT=8090 FITO_JWT_SECRETO=secreto-de-prueba-humo-0123456789abcdef \
FITO_ADMIN_CORREO=admin@fito.test FITO_ADMIN_CONTRASENA=admin-clave-larga \
FITO_CLAVE_FLOTA=$(printf 'ab%.0s' {1..32}) \
FITODIAGNOSTICO_CORS_ORIGENES=http://localhost:5700 FITO_FRONT_URL='http://localhost:5700/#' \
FITO_SMTP_PUERTO=1026 FITO_CORREO_ASINCRONO=false \
java -Xmx400m -jar target/fitodiagnostico-0.0.1-SNAPSHOT.jar
```

## 2. Front (5700) y correo

```
python3 -m http.server 5700 --bind 127.0.0.1        # raíz del front
node tests/humo/correo-falso.mjs                      # SMTP en 1026 y API tipo Mailpit en 8026
```

`correo-falso.mjs` no es Mailpit: guarda en memoria lo que llega al SMTP y responde solo `GET /api/v1/messages` y `/api/v1/message/{id}` (lo único que usa el humo). Si hay Mailpit de verdad (`mailpit` en el PATH), úsalo en 1025/8025 y quita `FITO_SMTP_PUERTO` y `MAILPIT`.

## 3. El humo

```
cd tests/humo && npm install
FRONT=http://localhost:5700 FRONT_API=http://localhost:8090/api/v1 API=http://localhost:8090/api/v1 \
MAILPIT=http://localhost:8026 node humo.mjs
```

`FRONT_API` es lo que hace que el front hable con 8090: abre cada página con `?api=` (sin él cae en `localhost:8080`, la demo). Otras: `CHROME` (por defecto `/usr/bin/google-chrome`), `ADMIN_CORREO`, `ADMIN_CLAVE`, `OMITIR="texto|texto"`, `CAPTURAS=carpeta` (guarda imágenes en pasos marcados). Sin correo en marcha, los pasos de correo se omiten.

Aparte, con las mismas variables: `node capturas.mjs` (imágenes de las vistas en `docs/capturas/`) y `node a11y.mjs` (axe-core, sale con 1 si hay violaciones).

## 4. Apagar

Mata el `java`, el `http.server` y el `correo-falso` que levantaste y confirma con `ss -ltn | grep -E ':(5700|8090|1026|8026)\b'`. El catálogo del backend de `develop` trae cinco especies (`atrapamoscas`, `cactus`, `girasol`, `helecho`, `suculenta`); el humo usa `helecho`.
