#!/usr/bin/env python3
"""Pone cada mascota del front junto al sprite de la OLED que dibuja el firmware, para revisarlas a ojo.

Sin navegador: el SVG de cada mascota sale de `tools/mascotas-svg.mjs` (Node, DOM mínimo) y se pinta aquí con un
rasterizador muy pequeño sobre PIL (rect, circle, ellipse, path con M L H V Q Z, polyline, transform, clases del CSS).
Los sprites salen de `firmware/sprites/arte/*.txt` del repo del backend (`git show`, no hace falta su checkout) y la
cara que el firmware pinta por código se les superpone con las mismas piezas que calcula `piezasDeCara`.

    python3 tools/comparar-mascotas.py                       # escribe docs/mascotas/*.png
    python3 tools/comparar-mascotas.py --arte ruta/al/arte   # sprites desde una carpeta en vez de git
    python3 tools/comparar-mascotas.py --oled <salida de previsualizar.py>/mascota   # F49: dormida y saludo; F56: los accesorios
    python3 tools/comparar-mascotas.py --firmware ruta/al/firmware                    # F56: el resto del firmware desde un árbol de trabajo

Imprime, por pose, qué tanto coincide la silueta de la planta (filas sobre la matera) entre sprite y front (IoU).

F56 (fase 14 del backend): además, y sin imágenes de por medio, compara EXACTO lo que el front calcó del firmware, leyéndolo
también con `git show` (o de `--firmware`): `frases.json` (todas las frases), las constantes de tiempo de `fito_mascota.h` y
`fito_mascota.c` (ms por cuadro, cuadros, vueltas, caída del desmayo, turnos), los sprites nuevos de `arte/*.txt` (rayos,
corazón, destellos, estrella, ojos en «x», accesorios) y la tabla `ANCLA_ACCESORIO` de `pantalla.cpp`. Para los accesorios
arma, de forma independiente al front, dónde cae cada sprite (punto de la cara de `pantalla.cpp` + ancla, con su aureola) y
lo compara píxel por píxel con lo que dibuja la mascota. Sale con código 1 si algo no coincide y escribe `fase14.png`.
"""
import argparse
import json
import math
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NS = "{http://www.w3.org/2000/svg}"
ESTADOS = ["SALUDABLE", "EN_RIESGO", "CRITICO"]
FAMILIAS = ["girasol", "cactus", "suculenta", "helecho", "carnivora", "generica"]
Y_MATERA = 46

# Nombre del sprite del firmware para cada (familia, estado, cuadro)
def nombre_sprite(familia, estado, cuadro):
    n = {"SALUDABLE": "saludable", "EN_RIESGO": "riesgo", "CRITICO": "critico"}[estado]
    if familia == "girasol":
        return f"girasol_{n}_{cuadro}"
    if familia == "cactus":
        return f"cactus_{n}"
    if familia == "suculenta":
        return f"suculenta_{n}_{cuadro}"
    if familia == "helecho":
        return f"helecho_{n}_{cuadro}"
    if familia == "generica":
        return f"planta_{n}_0"
    if estado == "SALUDABLE":
        return ["carni_abierta_0", "carni_media", "carni_cerrada"][cuadro]
    return f"carni_{n}_0"


# ---------------------------------------------------------------- sprites

def leer_fuente(ruta, args):
    """Un archivo del firmware (`firmware/...`): del árbol de trabajo si hay --firmware, si no con git show de la rama."""
    if args.firmware:
        with open(os.path.join(args.firmware, ruta.removeprefix("firmware/"))) as f:
            return f.read()
    return subprocess.check_output(["git", "-C", args.backend, "show", f"{args.rama}:{ruta}"], text=True)


def leer_arte(nombre, args):
    """Un sprite de `arte/` de cualquier tamaño, como lista de filas."""
    if args.arte:
        with open(os.path.join(args.arte, nombre + ".txt")) as f:
            texto = f.read()
    else:
        texto = leer_fuente(f"firmware/sprites/arte/{nombre}.txt", args)
    return [l for l in texto.split("\n") if l]


def leer_sprite(nombre, args):
    if args.arte:
        with open(os.path.join(args.arte, nombre + ".txt")) as f:
            texto = f.read()
    else:
        texto = subprocess.check_output(["git", "-C", args.backend, "show", f"{args.rama}:firmware/sprites/arte/{nombre}.txt"], text=True)
    filas = [l for l in texto.split("\n") if l]
    assert len(filas) == 64 and all(len(l) == 48 for l in filas), nombre
    return filas


def pintar_cara(im, cara):
    """Superpone la cara que el firmware dibuja por código (negro sobre el cuerpo) con las piezas de `piezasDeCara`."""
    if not cara:
        return
    d = ImageDraw.Draw(im)
    negro, blanco = (0, 0, 0), (255, 255, 255)
    for o in cara["ojos"]:
        d.rounded_rectangle([o["x"], o["y"], o["x"] + o["ancho"] - 1, o["y"] + o["alto"] - 1], radius=o["radio"], fill=negro)
        if o.get("brillo"):
            im.putpixel((o["brillo"]["x"], o["brillo"]["y"]), blanco)
    for c in cara["cejas"]:
        if c.get("medio"):
            for p in [(c["x1"], c["y1"]), (c["medio"]["x"], c["medio"]["y"]), (c["x2"], c["y2"])]:
                im.putpixel(p, negro)
        else:
            d.line([c["x1"], c["y1"], c["x2"], c["y2"]], fill=negro)
    for p in cara["boca"]:
        if 0 <= p["x"] < 48 and 0 <= p["y"] < 64:
            im.putpixel((p["x"], p["y"]), negro)
    if cara["lagrima"]:
        l = cara["lagrima"]
        for k in range(l["alto"]):
            im.putpixel((l["x"], l["y"] + k), negro)


def imagen_sprite(filas, cara):
    """Sprite como imagen RGB de 48x64: encendido = blanco, la cara por código = negro."""
    im = Image.new("RGB", (48, 64), (16, 16, 16))
    for y, fila in enumerate(filas):
        for x, c in enumerate(fila):
            if c == "#":
                im.putpixel((x, y), (255, 255, 255))
    pintar_cara(im, cara)
    return im


# ---------------------------------------------------------------- CSS mínimo

def quitar_media(css):
    salida, i = [], 0
    while i < len(css):
        if css.startswith("@media", i) or css.startswith("@supports", i) or css.startswith("@keyframes", i) or css.startswith("@view-transition", i):
            j = css.index("{", i)
            nivel, k = 1, j + 1
            while nivel:
                nivel += {"{": 1, "}": -1}.get(css[k], 0)
                k += 1
            i = k
        else:
            salida.append(css[i])
            i += 1
    return "".join(salida)


class Css:
    def __init__(self, ruta):
        css = re.sub(r"/\*.*?\*/", "", open(ruta, encoding="utf-8").read(), flags=re.S)
        raiz = re.search(r":root\s*\{([^}]*)\}", css)
        self.vars = dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", raiz.group(1)))
        self.reglas = []  # (especificidad, orden, selector, props)
        orden = 0
        for sel, cuerpo in re.findall(r"([^{}]+)\{([^{}]*)\}", quitar_media(css)):
            props = dict((k.strip(), v.strip()) for k, v in re.findall(r"([\w-]+)\s*:\s*([^;]+);", cuerpo))
            for una in re.split(r",(?![^(]*\))", sel):
                una = una.strip()
                if "mascota" in una or "masc-" in una or ".ilu-" in una or "hoja-" in una:
                    orden += 1
                    self.reglas.append((una, orden, props))

    def color(self, valor):
        if valor is None or valor == "none":
            return None
        m = re.fullmatch(r"var\((--[\w-]+)\)", valor)
        if m:
            return self.color(self.vars.get(m.group(1)))
        m = re.fullmatch(r"#([0-9a-fA-F]{6})", valor)
        if m:
            h = m.group(1)
            return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
        return None

    def estilo(self, clases, estado, atributos):
        """Presentación (atributos) y luego CSS por especificidad y orden, como el navegador."""
        est = {k: atributos[k] for k in ("fill", "stroke", "stroke-width", "stroke-linecap") if k in atributos}
        aplicables = []
        for sel, orden, props in self.reglas:
            esp = self._casa(sel, clases, estado)
            if esp:
                aplicables.append((esp, orden, props))
        for _, _, props in sorted(aplicables, key=lambda t: (t[0], t[1])):
            est.update(props)
        return est

    @staticmethod
    def _compuesto(txt):
        return set(re.findall(r"\.([\w-]+)", txt))

    def _casa(self, sel, clases, estado):
        m = re.fullmatch(r'\.mascota\[data-estado="(\w+)"\]\s*(.*)', sel)
        if m:
            if m.group(1) != estado:
                return 0
            resto = m.group(2).strip()
            if not resto:
                return 0
            es = re.fullmatch(r":is\((.*)\)", resto)
            opciones = [o.strip() for o in es.group(1).split(",")] if es else [resto]
            return 3 if any(self._compuesto(o) and self._compuesto(o) <= clases and " " not in o for o in opciones) else 0
        if " " in sel or "[" in sel or ":" in sel:
            return 0
        c = self._compuesto(sel)
        return len(c) if c and c <= clases else 0


# ---------------------------------------------------------------- rasterizador SVG mínimo

def mat_mul(a, b):
    return (a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
            a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5])


def leer_transform(txt):
    m = (1, 0, 0, 1, 0, 0)
    for nombre, args in re.findall(r"(\w+)\(([^)]*)\)", txt or ""):
        v = [float(x) for x in re.split(r"[ ,]+", args.strip()) if x]
        if nombre == "translate":
            t = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif nombre == "scale":
            t = (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0)
        elif nombre == "rotate":
            a = math.radians(v[0])
            c, s = math.cos(a), math.sin(a)
            t = (c, s, -s, c, 0, 0)
            if len(v) == 3:
                t = mat_mul(mat_mul((1, 0, 0, 1, v[1], v[2]), t), (1, 0, 0, 1, -v[1], -v[2]))
        elif nombre == "matrix":
            t = tuple(v)
        else:
            continue
        m = mat_mul(m, t)
    return m


def aplicar(m, p):
    return (m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5])


def subtrazos(d):
    """Cadena `d` -> lista de (puntos, cerrado). Soporta M L H V Q Z (mayúsculas y minúsculas)."""
    fichas = re.findall(r"[MmLlHhVvQqZz]|-?\d*\.?\d+(?:e-?\d+)?", d)
    res, actual, cerrado = [], [], False
    i, cmd, x, y, ini = 0, None, 0.0, 0.0, (0.0, 0.0)

    def nums(n):
        nonlocal i
        v = [float(t) for t in fichas[i:i + n]]
        i += n
        return v

    while i < len(fichas):
        if re.fullmatch(r"[A-Za-z]", fichas[i]):
            cmd = fichas[i]
            i += 1
            if cmd in "Zz":
                if actual:
                    res.append((actual, True))
                x, y = ini
                actual = []
                continue
        if cmd in "Mm":
            if actual:
                res.append((actual, False))
            a, b = nums(2)
            x, y = (a, b) if cmd == "M" else (x + a, y + b)
            ini = (x, y)
            actual = [(x, y)]
            cmd = "L" if cmd == "M" else "l"
        elif cmd in "Ll":
            a, b = nums(2)
            x, y = (a, b) if cmd == "L" else (x + a, y + b)
            actual.append((x, y))
        elif cmd in "Hh":
            (a,) = nums(1)
            x = a if cmd == "H" else x + a
            actual.append((x, y))
        elif cmd in "Vv":
            (b,) = nums(1)
            y = b if cmd == "V" else y + b
            actual.append((x, y))
        elif cmd in "Qq":
            cx, cy, ex, ey = nums(4)
            if cmd == "q":
                cx, cy, ex, ey = x + cx, y + cy, x + ex, y + ey
            for k in range(1, 13):
                t = k / 12
                actual.append(((1 - t) ** 2 * x + 2 * t * (1 - t) * cx + t * t * ex, (1 - t) ** 2 * y + 2 * t * (1 - t) * cy + t * t * ey))
            x, y = ex, ey
        else:
            raise ValueError(f"comando de path sin soporte: {cmd}")
    if actual:
        res.append((actual, False))
    return res


def rect_poligono(x, y, w, h, rx):
    rx = min(rx, w / 2, h / 2)
    if rx <= 0:
        return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    pts = []
    for cx, cy, a0 in [(x + w - rx, y + rx, -90), (x + w - rx, y + h - rx, 0), (x + rx, y + h - rx, 90), (x + rx, y + rx, 180)]:
        for k in range(9):
            a = math.radians(a0 + 90 * k / 8)
            pts.append((cx + rx * math.cos(a), cy + rx * math.sin(a)))
    return pts


def elipse_poligono(cx, cy, rx, ry):
    return [(cx + rx * math.cos(2 * math.pi * k / 72), cy + ry * math.sin(2 * math.pi * k / 72)) for k in range(72)]


def rasterizar(svg_txt, css, escala, ss=4):
    """El SVG de una mascota (viewBox 0 0 48 64) como imagen RGBA de (48*escala, 64*escala)."""
    raiz = ET.fromstring(svg_txt)
    estado = raiz.get("data-estado", "SALUDABLE")
    k = escala * ss
    im = Image.new("RGBA", (48 * k, 64 * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def pintar(el, m):
        if el.get("display") == "none":
            return
        m = mat_mul(m, leer_transform(el.get("transform")))
        etiqueta = el.tag.replace(NS, "")
        clases = set((el.get("class") or "").split())
        if etiqueta in ("svg", "g"):
            for h in el:
                pintar(h, m)
            return
        est = css.estilo(clases, estado, el.attrib)
        relleno = css.color(est.get("fill", "#000000"))
        trazo = css.color(est.get("stroke"))
        ancho = float(est.get("stroke-width", 1)) * math.sqrt(abs(m[0] * m[3] - m[1] * m[2])) * k
        redondo = est.get("stroke-linecap") == "round"
        f = lambda v: float(el.get(v, 0))
        if etiqueta == "rect":
            formas = [(rect_poligono(f("x"), f("y"), f("width"), f("height"), f("rx")), True)]
        elif etiqueta == "circle":
            formas = [(elipse_poligono(f("cx"), f("cy"), f("r"), f("r")), True)]
        elif etiqueta == "ellipse":
            formas = [(elipse_poligono(f("cx"), f("cy"), f("rx"), f("ry")), True)]
        elif etiqueta == "polyline":
            formas = [([tuple(float(c) for c in p.split(",")) for p in el.get("points").split()], False)]
        elif etiqueta == "path":
            formas = subtrazos(el.get("d"))
        else:
            return
        for puntos, cerrado in formas:
            px = [tuple(c * k for c in aplicar(m, p)) for p in puntos]
            if relleno and len(px) >= 3 and (cerrado or etiqueta != "polyline"):
                d.polygon(px, fill=relleno + (255,))
            if trazo and len(px) >= 2:
                linea = px + ([px[0]] if cerrado else [])
                d.line(linea, fill=trazo + (255,), width=max(1, round(ancho)), joint="curve")
                if redondo:
                    r = ancho / 2
                    for p in (linea if len(linea) < 400 else [linea[0], linea[-1]]):
                        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=trazo + (255,))

    pintar(raiz, (1, 0, 0, 1, 0, 0))
    return im.resize((48 * escala, 64 * escala), Image.LANCZOS)


# ---------------------------------------------------------------- armado de las imágenes

def fuente(tam):
    for ruta in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/TTF/DejaVuSans.ttf"):
        if os.path.exists(ruta):
            return ImageFont.truetype(ruta, tam)
    return ImageFont.load_default()


def silueta(im_rgb, umbral=40):
    """Filas sobre la matera donde hay planta: píxel encendido (sprite) o con alfa (front), en 48x64."""
    pix = im_rgb.load()
    return {(x, y) for y in range(Y_MATERA) for x in range(48) if pix[x, y][3] > 127} if im_rgb.mode == "RGBA" else None


def iou(a, b):
    return len(a & b) / len(a | b) if a | b else 1.0


def panel_front(dato, css, escala, fondo):
    im = rasterizar(dato["svg"], css, escala)
    lienzo = Image.new("RGB", im.size, fondo)
    lienzo.paste(im, (0, 0), im)
    return lienzo, rasterizar(dato["svg"], css, 1, ss=8)


def construir(datos, args, css):
    os.makedirs(args.salida, exist_ok=True)
    f_titulo, f_chica = fuente(14), fuente(11)
    resumen = []
    filas_resumen = {}

    def pareja(familia, estado, cuadro, escala):
        dato = datos[familia][f"{estado}#{cuadro}"]
        sprite = leer_sprite(nombre_sprite(familia, estado, cuadro), args)
        s_im = imagen_sprite(sprite, dato["cara"])
        fondo_front = (253, 246, 229)
        f_im, f_nativo = panel_front(dato, css, escala, fondo_front)
        s_grande = s_im.resize((48 * escala, 64 * escala), Image.NEAREST)
        # IoU de la silueta de la planta (filas sobre la matera), sin la cara
        sil_s = {(x, y) for y, fila in enumerate(sprite[:Y_MATERA]) for x, c in enumerate(fila) if c == "#"}
        pix = f_nativo.load()
        sil_f = {(x, y) for y in range(Y_MATERA) for x in range(48) if pix[x, y][3] > 127}
        return s_grande, f_im, iou(sil_s, sil_f)

    # una imagen por familia: una fila por estado, una pareja (sprite | front) por cuadro
    escala = args.escala
    for familia in FAMILIAS:
        claves = datos[familia]
        max_cuadros = max(sum(1 for k in claves if k.startswith(e + "#")) for e in ESTADOS)
        ancho_p, alto_p = 48 * escala, 64 * escala
        margen, cab = 10, 40
        W = margen + max_cuadros * (2 * ancho_p + margen) + 90
        H = cab + 3 * (alto_p + 24 + margen)
        hoja = Image.new("RGB", (W, H), (255, 255, 255))
        dh = ImageDraw.Draw(hoja)
        dh.text((margen, 10), f"{familia}: sprite de la OLED (izquierda de cada pareja, con la cara por código) y mascota del front (derecha)", fill=(20, 20, 20), font=f_titulo)
        for fila, estado in enumerate(ESTADOS):
            y0 = cab + fila * (alto_p + 24 + margen)
            dh.text((margen, y0), estado, fill=(20, 20, 20), font=f_titulo)
            cuadros = sorted(int(k.split("#")[1]) for k in claves if k.startswith(estado + "#"))
            for col, cuadro in enumerate(cuadros):
                s_im, f_im, valor = pareja(familia, estado, cuadro, escala)
                x0 = margen + col * (2 * ancho_p + margen)
                hoja.paste(s_im, (x0, y0 + 22))
                hoja.paste(f_im, (x0 + ancho_p, y0 + 22))
                dh.text((x0, y0 + 22 + alto_p + 2), f"cuadro {cuadro}  IoU {valor:.2f}", fill=(60, 60, 60), font=f_chica)
                filas_resumen[(familia, estado, cuadro)] = valor
        hoja.save(os.path.join(args.salida, f"{familia}.png"))

    # vista general: las seis familias, tres estados, cuadro 0, parejas chicas
    esc = 3
    ancho_p, alto_p = 48 * esc, 64 * esc
    margen = 8
    W = 110 + 3 * (2 * ancho_p + margen)
    H = 32 + len(FAMILIAS) * (alto_p + margen)
    gen = Image.new("RGB", (W, H), (255, 255, 255))
    dg = ImageDraw.Draw(gen)
    for col, estado in enumerate(ESTADOS):
        dg.text((110 + col * (2 * ancho_p + margen), 8), estado, fill=(20, 20, 20), font=f_titulo)
    for fila, familia in enumerate(FAMILIAS):
        y0 = 32 + fila * (alto_p + margen)
        dg.text((8, y0 + alto_p // 2 - 6), familia, fill=(20, 20, 20), font=f_titulo)
        for col, estado in enumerate(ESTADOS):
            s_im, f_im, _ = pareja(familia, estado, 0, esc)
            x0 = 110 + col * (2 * ancho_p + margen)
            gen.paste(s_im, (x0, y0))
            gen.paste(f_im, (x0 + ancho_p, y0))
    gen.save(os.path.join(args.salida, "comparacion.png"))

    print(f"{'familia':10} {'estado':10} cuadro  IoU de la planta (filas 0 a 45)")
    for (familia, estado, cuadro), valor in sorted(filas_resumen.items(), key=lambda t: (FAMILIAS.index(t[0][0]), ESTADOS.index(t[0][1]), t[0][2])):
        print(f"{familia:10} {estado:10} {cuadro:^6} {valor:.3f}")
    medio = sum(filas_resumen.values()) / len(filas_resumen)
    print(f"promedio {medio:.3f} en {len(filas_resumen)} poses")


# ---------------------------------------------------------------- F49: noche y saludo contra los cuadros de la OLED

FAMILIA_FIRMWARE = {"generica": "comun"}  # previsualizar.py llama «comun» a la planta común


def cuadro_oled(carpeta, nombre):
    """Un cuadro de 48x64 que guardó `noche_y_saludo()` de previsualizar.py (la mascota sola, cara y zzz incluidos)."""
    im = Image.open(os.path.join(carpeta, nombre + ".png")).convert("L")
    assert im.size == (48, 64), nombre
    rgb = Image.new("RGB", (48, 64), (16, 16, 16))
    rgb.paste((255, 255, 255), (0, 0), im.point(lambda v: 255 if v > 127 else 0))
    sil = {(x, y) for y in range(Y_MATERA) for x in range(48) if im.getpixel((x, y)) > 127}
    return rgb, sil


def comparar_accesorios_oled(datos, args):
    """F56: cada accesorio del front contra el recorte de 48x64 que deja `previsualizar.py` de la OLED (`acc_<accesorio>_<familia>_<col>.png`):
    todos los píxeles del sprite (con el balanceo del momento, redondeado como `lroundf`) tienen que estar encendidos en la OLED y
    todos los de su aureola apagados. Es lo más cerca de «mismos píxeles» que se puede estar sin flashear la placa."""
    mal, total = [], 0
    for a in datos["fase14"]["accesorios2500"]:
        ruta = os.path.join(args.oled, f"acc_{a['accesorio'].lower()}_{FAMILIA_FIRMWARE.get(a['familia'], a['familia'])}_{a['col']}.png")
        if not os.path.exists(ruta):
            continue
        im = Image.open(ruta).convert("L")
        t = re.match(r"translate\((-?[\d.]+) (-?\d+)\)", a["transform"])
        sx = int(math.copysign(math.floor(abs(float(t.group(1))) + 0.5), float(t.group(1)))) if t else 0  # lroundf: mitades lejos del cero
        sy = int(t.group(2)) if t else 0
        sprite = {(x + sx, y + sy) for x, y in pixeles_de_d(a["sprite"])}
        halo = {(x + sx, y + sy) for x, y in pixeles_de_d(a["aureola"])}
        dentro = lambda x, y: 0 <= x < 48 and 0 <= y < 64  # la pantalla recorta lo que sale (el sombrero en y < 0)
        fallan = sum(1 for x, y in sprite if dentro(x, y) and im.getpixel((x, y)) <= 127) + sum(1 for x, y in halo if dentro(x, y) and im.getpixel((x, y)) > 127)
        total += 1
        if fallan:
            mal.append((a["familia"], a["accesorio"], a["col"], fallan))
    print()
    print(f"accesorios contra los recortes acc_*.png de la OLED (previsualizar.py): {total - len(mal)}/{total} idénticos (sprite encendido y aureola apagada, píxel por píxel)")
    for m in mal:
        print("  difiere", m)
    return 1 if mal or total == 0 else 0


def construir_noche_saludo(datos, args, css):
    """dormida.png (seis familias x tres estados) y saludo.png (seis familias x 12 cuadros): cada celda es el cuadro de
    la OLED (arriba) y la mascota del front (abajo) en el mismo instante. IoU como siempre, sobre las filas 0 a 45."""
    f_titulo, f_chica = fuente(14), fuente(11)
    fondo_front = (253, 246, 229)
    filas = []

    def celda(nombre_oled, dato, esc):
        o_im, sil_o = cuadro_oled(args.oled, nombre_oled)
        f_im, f_nativo = panel_front(dato, css, esc, fondo_front)
        pix = f_nativo.load()
        sil_f = {(x, y) for y in range(Y_MATERA) for x in range(48) if pix[x, y][3] > 127}
        return o_im.resize((48 * esc, 64 * esc), Image.NEAREST), f_im, iou(sil_o, sil_f)

    # dormida
    esc, margen = 3, 8
    ancho_p, alto_p = 48 * esc, 64 * esc
    hoja = Image.new("RGB", (110 + 3 * (ancho_p + margen), 32 + len(FAMILIAS) * (2 * alto_p + 18 + margen)), (255, 255, 255))
    d = ImageDraw.Draw(hoja)
    for col, estado in enumerate(ESTADOS):
        d.text((110 + col * (ancho_p + margen), 8), f"{estado} de noche", fill=(20, 20, 20), font=f_titulo)
    for fila, familia in enumerate(FAMILIAS):
        y0 = 32 + fila * (2 * alto_p + 18 + margen)
        d.text((8, y0 + alto_p - 6), familia, fill=(20, 20, 20), font=f_titulo)
        for col, estado in enumerate(ESTADOS):
            n = {"SALUDABLE": "saludable", "EN_RIESGO": "riesgo", "CRITICO": "critico"}[estado]
            o_im, f_im, valor = celda(f"dormida_{FAMILIA_FIRMWARE.get(familia, familia)}_{n}", datos["noche"][familia][estado], esc)
            x0 = 110 + col * (ancho_p + margen)
            hoja.paste(o_im, (x0, y0))
            hoja.paste(f_im, (x0, y0 + alto_p))
            d.text((x0, y0 + 2 * alto_p + 2), f"IoU {valor:.2f}", fill=(60, 60, 60), font=f_chica)
            filas.append(("dormida", familia, estado, valor))
    hoja.save(os.path.join(args.salida, "dormida.png"))

    # saludo
    esc = 2
    ancho_p, alto_p = 48 * esc, 64 * esc
    hoja = Image.new("RGB", (110 + 12 * (ancho_p + 4), 32 + len(FAMILIAS) * (2 * alto_p + 16 + margen)), (255, 255, 255))
    d = ImageDraw.Draw(hoja)
    for k in range(12):
        d.text((110 + k * (ancho_p + 4), 8), f"cuadro {k}", fill=(20, 20, 20), font=f_chica)
    for fila, familia in enumerate(FAMILIAS):
        y0 = 32 + fila * (2 * alto_p + 16 + margen)
        d.text((8, y0 + alto_p - 6), familia, fill=(20, 20, 20), font=f_titulo)
        for k in range(12):
            o_im, f_im, valor = celda(f"saludo_{FAMILIA_FIRMWARE.get(familia, familia)}_{k:02d}", datos["saludo"][familia][k], esc)
            x0 = 110 + k * (ancho_p + 4)
            hoja.paste(o_im, (x0, y0))
            hoja.paste(f_im, (x0, y0 + alto_p))
            d.text((x0, y0 + 2 * alto_p + 1), f"{valor:.2f}", fill=(60, 60, 60), font=f_chica)
            filas.append(("saludo", familia, f"cuadro {k:02d}", valor))
    hoja.save(os.path.join(args.salida, "saludo.png"))

    print(f"{'pose':8} {'familia':10} {'cuadro':12} IoU de la planta (filas 0 a 45)")
    for pose, familia, cual, valor in filas:
        print(f"{pose:8} {familia:10} {cual:12} {valor:.3f}")
    for pose in ("dormida", "saludo"):
        vals = [v for p_, _, _, v in filas if p_ == pose]
        print(f"promedio {pose} {sum(vals) / len(vals):.3f} en {len(vals)} cuadros")


# ---------------------------------------------------------------- F56: la fase 14 (frases, constantes, sprites y anclas)

class Cuenta:
    """Cuenta comprobaciones por categoría y recuerda las que no coinciden."""

    def __init__(self):
        self.ok, self.mal, self.fallas = {}, {}, []

    def comprobar(self, categoria, nombre, esperado, obtenido):
        bien = esperado == obtenido
        (self.ok if bien else self.mal)[categoria] = (self.ok if bien else self.mal).get(categoria, 0) + 1
        if not bien:
            if isinstance(esperado, set) and isinstance(obtenido, set):  # píxeles: se dice qué falta y qué sobra, no los dos conjuntos
                detalle = f"faltan en el front {sorted(esperado - obtenido)[:8]}, sobran {sorted(obtenido - esperado)[:8]}"
                self.fallas.append(f"{categoria}: {nombre}\n    {detalle}")
            else:
                self.fallas.append(f"{categoria}: {nombre}\n    firmware: {esperado!r}\n    front:    {obtenido!r}")
        return bien


def pixeles_de_d(d):
    """Los píxeles [x, y] de un trazo armado con `pixelesD` (un `M x yh1v1h-1z` por píxel)."""
    return {(int(x), int(y)) for x, y in re.findall(r"M(-?\d+) (-?\d+)h1v1h-1z", d or "")}


def pixeles_de_sprite(filas, x0, y0):
    return {(x0 + x, y0 + y) for y, fila in enumerate(filas) for x, c in enumerate(fila) if c == "#"}


def aureola(pix):
    """Los 8 vecinos de cada píxel del sprite, sin los del propio sprite (`bitmapConHalo` de pantalla.cpp)."""
    return {(x + dx, y + dy) for x, y in pix for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy} - pix


def constantes_de_cabecera(args):
    """Los #define numéricos de fito_mascota.h (evaluando los que son una expresión de otros) y el arreglo FITO_DESMAYO_DY de .c."""
    texto = leer_fuente("firmware/src/nucleo/fito_mascota.h", args)
    valores = {}
    for nombre, valor in re.findall(r"^#define\s+(FITO_\w+)\s+(.+?)(?:\s*/\*.*)?$", texto, flags=re.M):
        valor = re.sub(r"(\d)u\b", r"\1", valor.strip())
        try:  # solo números, nombres ya leídos y + - * ( ): nada más se evalúa
            valores[nombre] = eval(valor, {"__builtins__": {}}, dict(valores)) if re.fullmatch(r"[\w\s*+()-]+", valor) else None
        except Exception:
            valores[nombre] = None
    c = leer_fuente("firmware/src/nucleo/fito_mascota.c", args)
    m = re.search(r"FITO_DESMAYO_DY\[FITO_DESMAYO_CUADROS\]\s*=\s*\{([^}]*)\}", c)
    valores["FITO_DESMAYO_DY"] = [int(v) for v in m.group(1).split(",")]
    return valores


def tablas_de_pantalla(args):
    """Anclas, puntos de la cara y separación de ojos de pantalla.cpp (lo que el front tiene que calcar)."""
    fuente = leer_fuente("firmware/src/pantalla.cpp", args)
    cuerpo = re.search(r"const Ancla ANCLA_ACCESORIO\[6\]\[4\]\[3\] = \{(.*?)\n\};", fuente, re.S).group(1)
    familias_fw = ["comun", "carnivora", "girasol", "cactus", "suculenta", "helecho"]
    lineas = [l for l in cuerpo.split("\n") if "//" in l]
    anclas = {}
    for familia, linea in zip(familias_fw, lineas):
        assert linea.split("//")[1].strip() == familia, (familia, linea)
        n = [int(v) for v in re.findall(r"-?\d+", linea.split("//")[0])]
        anclas["generica" if familia == "comun" else familia] = [[(n[6 * niv + 2 * a], n[6 * niv + 2 * a + 1]) for a in range(3)] for niv in range(4)]

    def puntos(nombre):
        m = re.search(rf"const Punto {nombre}(?:\[\d+\])?\s*=\s*\{{(.*?)\}};", fuente, re.S)
        n = [int(v) for v in re.findall(r"-?\d+", m.group(1))]
        return [(n[i], n[i + 1]) for i in range(0, len(n), 2)]

    geo = {nombre: int(re.search(rf"const Geometria {nombre} = \{{(-?\d+)", fuente).group(1)) for nombre in ("GEO_TRAMPA", "GEO_CHICA", "GEO_CACTUS")}
    g = [int(v) for v in re.search(r"const int CARNI_G\[3\] = \{([^}]*)\}", fuente).group(1).split(",")]
    return {
        "anclas": anclas,
        "girasol": puntos("CARA_GIRASOL"), "girasol_dormido": puntos("CARA_GIRASOL_DORMIDO")[0], "cactus": puntos("CARA_CACTUS"),
        "suculenta": puntos("CARA_SUCULENTA"), "matera": puntos("CARA_MATERA")[0], "geo": geo, "carni_g": g,
    }


def comparar_fase14(datos, args, css):
    f14 = datos["fase14"]
    cuenta = Cuenta()

    # frases: la tabla entera
    json_fw = json.loads(leer_fuente("firmware/sprites/frases.json", args))
    cuenta.comprobar("frases", "maximo", json_fw["maximo"], f14["frases"]["maximo"])
    for seccion in ("animo", "evento"):
        for familia, tabla in json_fw[seccion].items():
            for clave, frase in tabla.items():
                cuenta.comprobar("frases", f"{seccion}/{familia}/{clave}", frase, f14["frases"][seccion].get(familia, {}).get(clave))
        cuenta.comprobar("frases", f"{seccion}: mismas familias y claves", {f: sorted(t) for f, t in json_fw[seccion].items()}, {f: sorted(t) for f, t in f14["frases"][seccion].items()})

    # constantes de tiempo
    fw = constantes_de_cabecera(args)
    for nombre, valor in f14["constantes"].items():
        cuenta.comprobar("constantes", nombre, fw.get(nombre), valor)

    # efectos: cada cuadro contra su arte, en su esquina, con su aureola
    esquinas = {"rayos": (37, 0), "corazon": (38, 1), "destellos": (37, 0), "estrella": (37, 0)}
    for e in f14["efectos"]:
        filas = leer_arte(f"{e['efecto']}_{e['cuadro']}", args)
        esperado = pixeles_de_sprite(filas, *esquinas[e["efecto"]])
        cuenta.comprobar("efectos", f"{e['efecto']}_{e['cuadro']} (sprite)", esperado, pixeles_de_d(e["sprite"]))
        cuenta.comprobar("efectos", f"{e['efecto']}_{e['cuadro']} (aureola)", aureola(esperado), pixeles_de_d(e["aureola"]))

    # accesorios: dónde cae cada uno, armado aquí a partir de pantalla.cpp y del arte
    t = tablas_de_pantalla(args)
    sprites = {"SOMBRERO": leer_arte("accesorio_sombrero", args), "MONO": leer_arte("accesorio_mono", args),
               "GAFAS": leer_arte("accesorio_gafas", args), "GAFAS_ANCHA": leer_arte("accesorio_gafas_ancha", args)}
    carni_yo = [(32 - g) // 2 for g in t["carni_g"]]

    def cara(familia, nivel, cuadro):
        if familia == "girasol":
            return t["girasol_dormido"] if nivel == 3 else t["girasol"][nivel]
        if familia in ("cactus", "suculenta"):  # solo el girasol y la carnívora cambian de cuerpo dormidos: las demás repiten su nivel 0
            return t[familia][0 if nivel == 3 else nivel]
        if familia in ("generica", "helecho"):
            return t["matera"]
        yo = {0: carni_yo[cuadro], 1: 25, 2: 30, 3: carni_yo[2]}[nivel]
        return (24, yo)

    indice = {"SOMBRERO": 0, "MONO": 1, "GAFAS": 2}
    for a in f14["accesorios"]:
        clave = a["accesorio"] if not (a["accesorio"] == "GAFAS" and a["familia"] == "carnivora") else "GAFAS_ANCHA"
        dx, dy = t["anclas"][a["familia"]][a["nivel"]][indice[a["accesorio"]]]
        cx, cy = cara(a["familia"], a["nivel"], a["cuadro"])
        esperado = pixeles_de_sprite(sprites[clave], cx + dx, cy + dy)
        nombre = f"{a['familia']} {a['accesorio']} nivel {a['nivel']}" + (f" boca {a['cuadro']}" if a["familia"] == "carnivora" and a["nivel"] == 0 else "")
        cuenta.comprobar("accesorios", nombre + " (sprite)", esperado, pixeles_de_d(a["sprite"]))
        cuenta.comprobar("accesorios", nombre + " (aureola)", aureola(esperado), pixeles_de_d(a["aureola"]))

    # ojos en «x» de la pose de desmayo (nivel crítico): ojo_x_5 en (ex - 2, cy - 2) y ojo_x_3 en (17, 55) y (28, 55)
    x5, x3 = leer_arte("ojo_x_5", args), leer_arte("ojo_x_3", args)
    sep = {"girasol": t["geo"]["GEO_CHICA"], "suculenta": t["geo"]["GEO_CHICA"], "cactus": t["geo"]["GEO_CACTUS"], "carnivora": t["geo"]["GEO_TRAMPA"]}
    for o in f14["ojosX"]:
        familia = o["familia"]
        if familia in ("generica", "helecho"):
            esperado = [pixeles_de_sprite(x3, ex, 55) for ex in (17, 28)]
        else:
            cx, cy = cara(familia, 2, 0)
            esperado = [pixeles_de_sprite(x5, cx + lado * sep[familia] - 2, cy - 2) for lado in (-1, 1)]
        cuenta.comprobar("ojos en x", familia, esperado, [{(x, y) for x, y in p} for p in o["pixeles"]])

    # el resumen
    categorias = ["frases", "constantes", "efectos", "accesorios", "ojos en x"]
    print()
    print("fase 14: lo que el front calcó del firmware (git show de %s)" % ("el árbol de --firmware" if args.firmware else f"{args.rama} del backend"))
    print(f"{'categoría':12} {'coinciden':>10} {'difieren':>9}")
    for c in categorias:
        print(f"{c:12} {cuenta.ok.get(c, 0):>10} {cuenta.mal.get(c, 0):>9}")
    total_ok, total_mal = sum(cuenta.ok.values()), sum(cuenta.mal.values())
    print(f"total {total_ok} coinciden, {total_mal} difieren")
    for falla in cuenta.fallas[:40]:
        print("  FALLA " + falla)
    imagen_fase14(f14, args, css, sprites)
    return 1 if total_mal else 0


def imagen_fase14(f14, args, css, sprites):
    """fase14.png: los accesorios (seis familias x cuatro), la pose de desmayo y los once cuadros de los efectos, del front."""
    f_titulo, f_chica = fuente(14), fuente(11)
    esc, margen = 3, 8
    ancho_p, alto_p = 48 * esc, 64 * esc
    fondo = (253, 246, 229)
    familias = list(f14["imagenes"]["accesorios"])
    accesorios = ["NINGUNO", "SOMBRERO", "MONO", "GAFAS"]
    efectos = list(f14["imagenes"]["efectos"].items())
    W = max(110 + (len(accesorios) + 1) * (ancho_p + margen), margen + len(efectos) * (ancho_p + margen))
    H = 30 + len(familias) * (alto_p + margen) + 30 + alto_p + 40
    hoja = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(hoja)

    def pegar(svg_txt, x, y):
        im = rasterizar(svg_txt, css, esc)
        lienzo = Image.new("RGB", im.size, fondo)
        lienzo.paste(im, (0, 0), im)
        hoja.paste(lienzo, (x, y))

    d.text((margen, 8), "fase 14 en el front: accesorios (ninguno, sombrero, moño, gafas) y, al final, la pose de desmayo", fill=(20, 20, 20), font=f_titulo)
    for fila, familia in enumerate(familias):
        y0 = 30 + fila * (alto_p + margen)
        d.text((margen, y0 + alto_p // 2 - 6), familia, fill=(20, 20, 20), font=f_titulo)
        for col, a in enumerate(accesorios):
            pegar(f14["imagenes"]["accesorios"][familia][a], 110 + col * (ancho_p + margen), y0)
        pegar(f14["imagenes"]["desmayada"][familia], 110 + len(accesorios) * (ancho_p + margen), y0)
    y1 = 30 + len(familias) * (alto_p + margen)
    d.text((margen, y1), "efectos de los eventos: rayos_0..2, corazon_0..1, destellos_0..2, estrella_0..2", fill=(20, 20, 20), font=f_titulo)
    for col, (nombre, svg_txt) in enumerate(efectos):
        x0 = margen + col * (ancho_p + margen)
        pegar(svg_txt, x0, y1 + 24)
        d.text((x0, y1 + 24 + alto_p + 2), nombre, fill=(60, 60, 60), font=f_chica)
    hoja.save(os.path.join(args.salida, "fase14.png"))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--backend", default=os.path.expanduser("~/Documentos/fitodiagnostico-backend"), help="repo del backend (se lee con git show)")
    p.add_argument("--rama", default="origin/develop")
    p.add_argument("--arte", help="carpeta con los .txt de los sprites (en vez de git)")
    p.add_argument("--firmware", help="F56: carpeta firmware/ del backend (frases.json, fito_mascota.h, pantalla.cpp) en vez de git")
    p.add_argument("--salida", default=os.path.join(RAIZ, "docs", "mascotas"))
    p.add_argument("--escala", type=int, default=4, help="aumento de las imágenes por familia")
    p.add_argument("--oled", help="F49: carpeta mascota/ que deja `previsualizar.py` (cuadros de 48x64 de la OLED); "
                                  "compara la pose dormida y el saludo en vez de los sprites")
    args = p.parse_args()
    os.makedirs(args.salida, exist_ok=True)
    css = Css(os.path.join(RAIZ, "css", "estilos.css"))
    crudo = subprocess.check_output(["node", os.path.join(RAIZ, "tools", "mascotas-svg.mjs")], cwd=RAIZ)
    datos = json.loads(crudo)
    if args.oled:
        construir_noche_saludo(datos, args, css)
        return comparar_accesorios_oled(datos, args)
    construir(datos, args, css)
    return comparar_fase14(datos, args, css)


if __name__ == "__main__":
    sys.exit(main())
