# Cómo correr el humo en esta máquina

El humo (`tests/humo/humo.mjs`) abre el front y un backend reales en Chrome headless. Aquí no hay Mailpit ni Docker, y las demos viven en 5500, 8080 y 8443, así que todo va en puertos alternos y no toca esas.

## 1. Backend (8090, H2 en memoria)

Jar: el de `target/` del backend puede ir atrás de `develop` (a 16-nov no traía la fase 13). Para uno al día sin tocar el repo del backend: `git -C <backend> archive HEAD | tar -x -C <carpeta>` y, ahí, `MAVEN_OPTS=-Xmx512m ./mvnw -q -DskipTests package` (un solo Maven a la vez; mira `free -m`).

**PATCH y CORS (F56):** `ConfiguracionCors` del backend permite `GET, POST, PUT, DELETE, OPTIONS` y no `PATCH`, así que el paso del selector de accesorio no puede pasar con el front (5700) y la API (8090) en orígenes distintos. Hasta que el backend lo agregue, el humo se corre contra una copia con `"PATCH"` en esa lista (`sed -i 's/"PUT", "DELETE"/"PUT", "PATCH", "DELETE"/' src/main/java/com/vivero/fitodiagnostico/adaptador/entrada/rest/ConfiguracionCors.java` en la copia, no en el repo).

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
MAILPIT=http://localhost:8026 SIMULADOR=/ruta/simulador/simulador_esp32.py node humo.mjs
```

Para el paso de la salud de la matera (F55) el humo arranca el simulador del backend con `--falla temperatura`: pásale `SIMULADOR=<ruta>/simulador_esp32.py` (con su `mqtt_minimo.py` al lado; sale de `git -C <backend> show origin/develop:simulador/simulador_esp32.py`). Sin la variable ese paso se omite. El humo lo apaga al terminar el paso.

`FRONT_API` es lo que hace que el front hable con 8090: abre cada página con `?api=` (sin él cae en `localhost:8080`, la demo). Otras: `CHROME` (por defecto `/usr/bin/google-chrome`), `ADMIN_CORREO`, `ADMIN_CLAVE`, `OMITIR="texto|texto"`, `CAPTURAS=carpeta` (guarda imágenes en pasos marcados). Sin correo en marcha, los pasos de correo se omiten.

Aparte, con las mismas variables: `node capturas.mjs` (imágenes de las vistas en `docs/capturas/`, ahora con un accesorio por planta y la caricia con su corazón y su frase) y `node a11y.mjs` (axe-core, sale con 1 si hay violaciones).

Los pasos de la mascota completa (F56) usan el catálogo (`suculenta`), el jar de las fases 13 y 14, el correo falso y, para la caricia de la matera, el reto y la credencial del chip que ya arma el humo (`chipPideCredencial`); no necesitan el simulador (solo el paso de la salud, F55, lo usa).

## 4. Apagar

Mata el `java`, el `http.server` y el `correo-falso` que levantaste y confirma con `ss -ltn | grep -E ':(5700|8090|1026|8026)\b'`. El catálogo del backend de `develop` trae cinco especies (`atrapamoscas`, `cactus`, `girasol`, `helecho`, `suculenta`); el humo usa `helecho`.

## 5. Comparar con el firmware (sin navegador)

```
python3 tools/comparar-mascotas.py                       # pose por pose (IoU) y la fase 14: frases, constantes, efectos, ojos en «x» y accesorios, exacto
python3 firmware/sprites/previsualizar.py <carpeta>      # en el repo del backend: deja los recortes de la OLED en <carpeta>/mascota
python3 tools/comparar-mascotas.py --oled <carpeta>/mascota   # dormida, saludo y los 72 accesorios contra los recortes de la OLED
```
Lee el backend con `git show origin/develop:...` (`--backend`, `--rama`) o de un árbol (`--firmware`, `--arte`). Sale con 1 si algo de la fase 14 no coincide.
