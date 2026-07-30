/* ============================================================
   Página pública del conduce — la abre el CLIENTE al escanear el QR.

   Autónoma a propósito:
     · No lee localStorage. El teléfono del cliente nunca ha visto la
       base de la planta.
     · No carga el contrato ni nada del resto de e-Ticket.
     · Vive de lo que trae la URL, en el FRAGMENTO (#), que nunca viaja
       al servidor: el detalle del conduce no queda en registros de
       acceso ni en el historial del proveedor de alojamiento.
   ============================================================ */
"use strict";

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------ lectura de la URL
   Mismo formato que produce ConduceContract.encodeQR (v4), más los campos
   que añade e-Ticket para poder armar la factura sin conocer la planta. */
function leerFragmento() {
  const h = location.hash.replace(/^#/, "");
  if (!h) return null;
  const q = new URLSearchParams(h);
  if (!q.get("tk")) return null;
  const n = (s) => { const v = Number(s); return Number.isFinite(v) ? v : null; };
  return {
    ticket: q.get("tk"),
    company: q.get("co") || null,
    plant: q.get("pl") || null,
    truck: q.get("tr") || null,
    vol: n(q.get("cy")),
    mix: q.get("mx") || null,
    batch: q.get("bt") || null,
    date: q.get("dt") || null,
    price: n(q.get("pr")),
    tripFee: n(q.get("tf")),
    extra: n(q.get("ex")),
    extraLabel: q.get("xl") || null,
    taxPct: n(q.get("tx")),
  };
}

/* ------------------------------------------------------------ formato */
const money = (v) =>
  v == null ? "—" : v.toLocaleString("es-PR", { style: "currency", currency: "USD" });
const numf = (v, dp = 2) =>
  v == null ? "—" : v.toLocaleString("es-PR", { minimumFractionDigits: 0, maximumFractionDigits: dp });
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fechaLarga(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString("es-PR",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function hora12(hm) {
  if (!hm) return null;
  const [h, m] = String(hm).split(":").map(Number);
  if (!Number.isFinite(h)) return hm;
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m || 0).padStart(2, "0")} ${ap}`;
}

/* ------------------------------------------------------------ factura
   Misma fórmula que etInvoice() en la herramienta de la planta. */
function calcularFactura(d) {
  const cy = d.vol || 0;
  const material = cy * (d.price || 0);
  const viaje = d.tripFee || 0;
  const otros = d.extra || 0;
  const subtotal = material + viaje + otros;
  const tax = subtotal * ((d.taxPct || 0) / 100);
  return { cy, material, viaje, otros, subtotal, tax, total: subtotal + tax };
}
const hayFactura = (d) => (d.price || 0) > 0 || (d.tripFee || 0) > 0 || (d.extra || 0) > 0;

/* ------------------------------------------------------------ pintar */
let DATOS = null, FACTURA = null;

function pintar(d) {
  DATOS = d;
  $("co").textContent = d.company || "Su entrega";
  $("foot-co").textContent = d.company || "";
  $("foot-key").textContent = d.ticket;
  $("tk").textContent = d.ticket;

  const f = fechaLarga(d.date), h = hora12(d.batch);
  $("when").textContent = [f, h ? "· cargado a las " + h : null].filter(Boolean).join(" ") || "";

  /* Lenguaje del cliente: nada de "batch", "CY seco", ni códigos internos. */
  const filas = [
    ["Volumen entregado", d.vol != null ? `${numf(d.vol)} yd³` : null, "yardas cúbicas"],
    ["Tipo de mezcla", d.mix, null],
    ["Camión", d.truck, null],
    ["Salió de", d.plant, null],
  ].filter((r) => r[1]);
  $("detalle").innerHTML = filas.map(([k, v, s]) =>
    `<div class="r"><dt>${esc(k)}</dt><dd>${esc(v)}${s ? `<s>${esc(s)}</s>` : ""}</dd></div>`).join("");

  if (!hayFactura(d)) {
    $("factura-card").hidden = true;
    $("correo-card").querySelector("p").textContent = "Le enviamos el conduce listo para imprimir.";
  } else {
    FACTURA = calcularFactura(d);
    const li = (desc, sub, amount, cls) =>
      `<div class="li ${cls || ""}"><div class="d">${esc(desc)}${sub ? `<s>${esc(sub)}</s>` : ""}</div>
       <div class="a">${money(amount)}</div></div>`;
    let html = "";
    if (FACTURA.material) html += li("Hormigón", `${numf(FACTURA.cy)} yd³ × ${money(d.price)}`, FACTURA.material);
    if (FACTURA.viaje) html += li("Viaje", null, FACTURA.viaje);
    if (FACTURA.otros) html += li(d.extraLabel || "Cargo adicional", null, FACTURA.otros);
    html += `<div class="sep"></div>`;
    html += li("Subtotal", null, FACTURA.subtotal, "sub");
    if (FACTURA.tax) html += li("Impuesto", `${numf(d.taxPct)} %`, FACTURA.tax, "sub");
    $("factura").innerHTML = html;
    $("total").textContent = money(FACTURA.total);
    pintarMetodos();
  }

  prepararImpresion(d, FACTURA);
  $("app").hidden = false;
  document.title = `Conduce ${d.ticket}${d.company ? " — " + d.company : ""}`;
}

/* ------------------------------------------------------------ hoja imprimible */
function prepararImpresion(d, fac) {
  const row = (k, v) => `<tr><td>${esc(k)}</td><td class="a">${esc(v)}</td></tr>`;
  const money2 = (k, v, cls) => `<tr class="${cls || ""}"><td>${esc(k)}</td><td class="a">${money(v)}</td></tr>`;
  let inv = "";
  if (fac) {
    inv = `<h4>Factura</h4><table>
      ${fac.material ? money2(`Hormigón — ${numf(fac.cy)} yd³ × ${money(d.price)}`, fac.material) : ""}
      ${fac.viaje ? money2("Viaje", fac.viaje) : ""}
      ${fac.otros ? money2(d.extraLabel || "Cargo adicional", fac.otros) : ""}
      ${money2("Subtotal", fac.subtotal)}
      ${fac.tax ? money2(`Impuesto (${numf(d.taxPct)} %)`, fac.tax) : ""}
      ${money2("Total", fac.total, "tot")}
    </table>`;
  }
  $("print-doc").innerHTML = `
    <div class="ph">
      <div class="n">${esc(d.company || "Conduce")}</div>
      <div class="t">Conduce<b>${esc(d.ticket)}</b>${esc(fechaLarga(d.date) || "")}</div>
    </div>
    <h4>Entrega</h4>
    <table>
      ${d.vol != null ? row("Volumen", numf(d.vol) + " yd³") : ""}
      ${d.mix ? row("Mezcla", d.mix) : ""}
      ${d.truck ? row("Camión", d.truck) : ""}
      ${d.plant ? row("Planta", d.plant) : ""}
      ${d.batch ? row("Hora de carga", hora12(d.batch)) : ""}
    </table>
    ${inv}
    <div class="note">Documento generado desde el enlace del conduce.
      Demostración: no representa un cobro procesado.</div>`;
}

/* ------------------------------------------------------------ métodos de pago
   Iconos PROPIOS, sobrios, en el estilo del sistema. NO son los logotipos
   oficiales de las marcas: cada una tiene guías de uso y recursos autorizados
   que hay que usar en producción (ver README). */
const ICO_PAYPAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 20l2.2-13h6.1a3.4 3.4 0 0 1 0 6.8H9.6"/><path d="M9.9 20l.8-4.6"/></svg>`;
const ICO_APPLE  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16.2 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.6 2.3 2.8 2.2 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.2.5-.8.9-1.6 1.1-2.4-2.4-.9-2.9-3.5-1.9-3.6z"/><path d="M14.3 5.6c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.2z"/></svg>`;
const ICO_ATH    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M10.4 5.4h3.2M12 18.2h.01"/><path d="M9.4 11.2h5.2M12 8.6v5.2"/></svg>`;

const METODOS = [
  { id: "paypal", nombre: "PayPal", desc: "Pague con su cuenta PayPal", ico: ICO_PAYPAL },
  { id: "applepay", nombre: "Apple Pay", desc: "Pago rápido con Face ID o Touch ID", ico: ICO_APPLE, soloApple: true },
  { id: "athmovil", nombre: "ATH Móvil", desc: "Desde su banco en Puerto Rico", ico: ICO_ATH },
];

/* Apple Pay solo se ofrece si el dispositivo puede usarlo: no tiene sentido
   mostrar una opción que no va a funcionar. */
function applePayDisponible() {
  try { return !!(window.ApplePaySession && window.ApplePaySession.canMakePayments()); }
  catch (_) { return false; }
}

function pintarMetodos() {
  const disponibles = METODOS.filter((m) => !m.soloApple || applePayDisponible());
  $("methods").innerHTML = disponibles.map((m) => `
    <button class="method" onclick="alPagar('${m.id}')">
      <span class="ico">${m.ico}</span>
      <span class="nm"><b>${esc(m.nombre)}</b><s>${esc(m.desc)}</s></span>
      <span class="go">›</span>
    </button>`).join("");
}

/* ============================================================
   PUNTO DE INTEGRACIÓN ÚNICO — PAGO
   ------------------------------------------------------------
   Aquí NO hay procesador de pagos, y es deliberado. Cobrar de verdad
   exige cosas que no son código:

     · PayPal    — cuenta de comercio de la concretera + credenciales
                   (client id/secret) que solo pueden vivir en el servidor.
     · Apple Pay — Merchant ID de Apple, certificado de comercio y
                   **dominio verificado** ante Apple; además exige HTTPS
                   y la sesión se valida contra Apple desde el backend.
     · ATH Móvil — cuenta de comercio de EVERTEC y su API key de negocio,
                   igualmente del lado del servidor.

   En los tres casos vale la misma regla: el número de tarjeta o las
   credenciales del cliente NUNCA pasan por esta página ni por el servidor
   que la sirve. El cobro se completa en el entorno del proveedor.

   Cuando Víctor escoja, esta función es lo ÚNICO que cambia:

     async function iniciarPago(metodo, factura) {
       const r = await fetch("/api/pagos", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ metodo, conduce: DATOS.ticket,
                                compania: DATOS.company,
                                total: factura.total, moneda: "USD" }),
       });
       const { urlDeCobro } = await r.json();
       location.href = urlDeCobro;     // entorno del proveedor
     }
   ============================================================ */
function iniciarPago(metodo, factura) {
  console.info("[e-Ticket] iniciarPago() — punto de integración sin proveedor:", metodo, factura);
  return { estado: "sin-procesador", metodo, cobrado: false };
}

/* ============================================================
   PUNTO DE INTEGRACIÓN — CORREO
   Enviar requiere un servicio de correo (Postmark, SES, Resend…) con
   dominio verificado. Desde el navegador no se puede ni se debe: haría
   falta exponer credenciales. El backend recibe la petición, arma el
   PDF del conduce y la factura, y lo envía.

     async function enviarPorCorreo(email, factura) {
       await fetch("/api/enviar-conduce", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ email, conduce: DATOS.ticket, factura }),
       });
     }
   Mientras tanto el cliente descarga o imprime desde su teléfono.
   ============================================================ */
function enviarPorCorreo(email, factura) {
  console.info("[e-Ticket] enviarPorCorreo() — punto de integración sin servicio:", email, factura);
  return { estado: "sin-servicio", enviado: false };
}

/* ------------------------------------------------------------ interfaz */
function aviso(titulo, cuerpo) {
  $("sheet-title").textContent = titulo;
  $("sheet-body").innerHTML = cuerpo;
  $("sheet").hidden = false;
}
function cerrarAviso() { $("sheet").hidden = true; }

function alPagar(metodoId) {
  const m = METODOS.find((x) => x.id === metodoId) || { nombre: "el proveedor" };
  const r = iniciarPago(metodoId, FACTURA);
  /* Confirmación honesta: nunca puede parecer que cobró, ni por un instante. */
  aviso(`Se redirigiría a ${m.nombre}`, `
    Aquí se le llevaría a <b>${esc(m.nombre)}</b> para completar el pago de
    <b>${money(FACTURA && FACTURA.total)}</b>.<br><br>
    Esta es una <b>demostración</b>: <b>no se ha hecho ningún cargo</b>, no se le
    ha pedido ningún dato de tarjeta ni credencial, y no se ha abierto ninguna
    pasarela de pago.<br><br>
    Mientras tanto, pague como acostumbra con la compañía.`);
  return r;
}
function alEnviarCorreo() {
  const email = $("email").value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    aviso("Revise el correo", "Esa dirección no parece válida. Escríbala completa, por ejemplo <b>nombre@correo.com</b>.");
    return;
  }
  enviarPorCorreo(email, FACTURA);
  aviso("Envío no disponible todavía", `
    Esta es una <b>demostración</b>: el envío por correo necesita el servicio
    de correo de la compañía, que aún no está conectado.<br><br>
    Puede guardar su conduce ahora con <b>Descargar o imprimir</b>.`);
}

/* ------------------------------------------------------------ arranque */
function arrancar() {
  const d = leerFragmento();
  if (!d) { $("oops").hidden = false; return; }
  try { pintar(d); }
  catch (e) { console.error(e); $("app").hidden = true; $("oops").hidden = false; }
}
window.addEventListener("hashchange", () => location.reload());
document.addEventListener("DOMContentLoaded", arrancar);
