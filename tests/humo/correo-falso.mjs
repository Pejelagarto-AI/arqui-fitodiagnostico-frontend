// Sustituto mínimo de Mailpit para máquinas sin Mailpit ni Docker: un SMTP que guarda los correos en memoria y
// responde lo único que el humo consulta de la API de Mailpit (GET /api/v1/messages y /api/v1/message/{id}).
//   SMTP_PUERTO=1026 HTTP_PUERTO=8026 node correo-falso.mjs
// y el backend con FITO_SMTP_PUERTO=1026; el humo con MAILPIT=http://localhost:8026.
import net from "node:net";
import http from "node:http";

const correos = [];
const decodificarQp = (t) => t.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const decodificarPalabra = (t) =>
  t.replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi, (_, k, v) =>
    k.toLowerCase() === "b" ? Buffer.from(v, "base64").toString("utf8") : Buffer.from(decodificarQp(v.replace(/_/g, " ")), "latin1").toString("utf8"));

function interpretar(para, crudo) {
  const [cab, ...resto] = crudo.split(/\r?\n\r?\n/);
  const cuerpoCrudo = resto.join("\n\n");
  const cabs = cab.replace(/\r?\n[ \t]+/g, " ");
  const asunto = decodificarPalabra((cabs.match(/^Subject:\s*(.*)$/im) || [, ""])[1]);
  let texto = cuerpoCrudo;
  const limite = (cabs.match(/boundary="?([^";\s]+)"?/i) || [])[1];
  if (limite) {
    const parte = cuerpoCrudo.split("--" + limite).find((p) => /content-type:\s*text\/plain/i.test(p)) || cuerpoCrudo;
    const [ph, ...pc] = parte.split(/\r?\n\r?\n/);
    texto = pc.join("\n\n");
    if (/quoted-printable/i.test(ph)) texto = Buffer.from(decodificarQp(texto), "latin1").toString("utf8");
    else if (/base64/i.test(ph)) texto = Buffer.from(texto.replace(/\s/g, ""), "base64").toString("utf8");
  } else if (/quoted-printable/i.test(cabs)) texto = Buffer.from(decodificarQp(texto), "latin1").toString("utf8");
  else if (/Content-Transfer-Encoding:\s*base64/i.test(cabs)) texto = Buffer.from(texto.replace(/\s/g, ""), "base64").toString("utf8");
  return { ID: String(correos.length + 1), Subject: asunto, To: para.map((a) => ({ Address: a })), Text: texto };
}

net.createServer((socket) => {
  let modoDatos = false, buffer = "", para = [], datos = "";
  const decir = (l) => socket.write(l + "\r\n");
  decir("220 correo-falso");
  socket.on("data", (d) => {
    buffer += d.toString("latin1");
    for (;;) {
      if (modoDatos) {
        const fin = buffer.indexOf("\r\n.\r\n");
        if (fin < 0) return;
        datos = buffer.slice(0, fin).replace(/\r\n\.\./g, "\r\n.");
        buffer = buffer.slice(fin + 5);
        modoDatos = false;
        correos.push(interpretar(para, datos));
        decir("250 ok");
        continue;
      }
      const i = buffer.indexOf("\r\n");
      if (i < 0) return;
      const linea = buffer.slice(0, i);
      buffer = buffer.slice(i + 2);
      const c = linea.toUpperCase();
      if (c.startsWith("EHLO") || c.startsWith("HELO")) decir("250 correo-falso");
      else if (c.startsWith("MAIL FROM")) { para = []; decir("250 ok"); }
      else if (c.startsWith("RCPT TO")) { para.push((linea.match(/<([^>]*)>/) || [, ""])[1]); decir("250 ok"); }
      else if (c === "DATA") { modoDatos = true; decir("354 sigue"); }
      else if (c === "QUIT") { decir("221 chao"); socket.end(); }
      else decir("250 ok");
    }
  });
  socket.on("error", () => {});
}).listen(Number(process.env.SMTP_PUERTO || 1026), "127.0.0.1");

http.createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  const m = req.url.match(/^\/api\/v1\/message\/(\d+)$/);
  if (req.url === "/api/v1/messages") res.end(JSON.stringify({ messages: correos.map(({ Text, ...r }) => r) }));
  else if (m && correos[m[1] - 1]) res.end(JSON.stringify(correos[m[1] - 1]));
  else { res.statusCode = 404; res.end("{}"); }
}).listen(Number(process.env.HTTP_PUERTO || 8026), "127.0.0.1");
