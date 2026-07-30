/* ============================================================
   e-Ticket — Despacho / Carga.  Producto de la concretera.

   Producto independiente: se vende solo, tendrá su propio backend y su
   propio dominio. No depende de ningún otro sistema para funcionar.

   El contrato (shared/conduce-contract.js) es OPCIONAL — solo sirve para
   entenderse con un inspector que use QCheck. Si no está, conduce-min.js
   provee lo mínimo y todo sigue igual.

   Todo el acceso a datos pasa por EtDatos (datos.js): cuando llegue el
   backend propio se cambia ahí y esta pantalla no se entera.
   ============================================================ */
"use strict";

const C = window.ConduceContract;
const THEME_KEY = "eticket-theme";

let etStoreMissing = false;

/* ------------------------------------------------------------ helpers */
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function num(v) { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function fmt(n, dp = 1) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("es-PR", { minimumFractionDigits: 0, maximumFractionDigits: dp });
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function nowHM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function fmtDateLong(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" });
}
function toast(msg, bad) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.toggle("bad", !!bad);
  el.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}
const $ = (id) => document.getElementById(id);
const val = (id) => $(id).value.trim();

/* ------------------------------------------------------------ tema */
const ICON_SUN = `<svg viewBox="0 0 24 24" style="width:56%;height:56%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.3"/><path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5"/></svg>`;
const ICON_MOON = `<svg viewBox="0 0 24 24" style="width:54%;height:54%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 14.5A8.6 8.6 0 0 1 9.5 3.8a8.6 8.6 0 1 0 10.7 10.7z"/></svg>`;
function etApplyTheme(t) {
  document.documentElement.dataset.theme = t;
  const b = $("theme-toggle");
  if (b) { b.innerHTML = t === "dark" ? ICON_SUN : ICON_MOON; b.title = t === "dark" ? "Modo claro" : "Modo oscuro"; }
}
function etToggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next); etApplyTheme(next);
}

/* ------------------------------------------------------------ datos
   Todo el acceso al almacenamiento pasa por EtDatos (datos.js).
   Esta pantalla no sabe si detrás hay localStorage o una API. */
function etConduces() { return EtDatos.conduces(); }
function etReadStore() { return EtDatos.existe() ? {} : null; }

/* ------------------------------------------------------------ estado del conduce
   Enriquecimiento de obra (llegada, pruebas, veredicto). Hoy solo llega si
   hay integración; cuando exista el backend entrará por API. Nunca se calcula
   aquí: e-Ticket lee lo que le devuelvan. */
const RESULT_FIELDS = ["slump", "air", "uw", "temp", "cs1", "cs5", "cs28"];
function etStatus(t) {
  if (t.rejected === true) return { k: "rej", label: "Rechazado" };
  if (RESULT_FIELDS.some((f) => t[f] != null)) return { k: "ok", label: "Resultado" };
  if (t.arrive || t.start || t.end || t.testTime) return { k: "rec", label: "Recibido" };
  return { k: "desp", label: "Despachado" };
}

/* ------------------------------------------------------------ formulario
   El catálogo sale ENTERO de la configuración de la planta (setup.html).
   Nada se infiere del histórico y nada viene quemado en el código. */
let cfg = null;

function etFillSelects() {
  $("f-company-label").textContent = cfg.company;
  $("f-plant").innerHTML = cfg.plants
    .map((p) => `<option value="${esc(p.name)}"${p.default ? " selected" : ""}>${esc(p.name)}</option>`).join("");
  $("f-mix").innerHTML = cfg.mixes
    .map((m) => `<option value="${esc(m.code)}"${m.default ? " selected" : ""}>${esc(m.code)}${m.desc ? " — " + esc(m.desc) : ""}</option>`).join("");
}
/* El próximo conduce lo lleva el contador de la configuración, no el histórico. */
function etSuggestTicket() {
  $("f-ticket").value = String(cfg.nextTicket);
  $("ticket-hint").textContent = `siguiente de ${cfg.company}`;
}
function etAdvanceCounter(usedTicket) {
  const n = Number(usedTicket);
  cfg.nextTicket = Number.isFinite(n) ? n + 1 : cfg.nextTicket + 1;
  etConfigWrite(cfg);
}
function etVol(d) {
  const v = Math.min(14, Math.max(0.5, (num(val("f-vol")) ?? 10) + d));
  $("f-vol").value = String(Math.round(v * 2) / 2);
}
function etNow() { $("f-batch").value = nowHM(); }
function etResetForm() {
  etFillSelects();
  $("f-vol").value = "10";
  $("f-truck").value = "";
  $("f-extra").value = "";
  $("f-extra-label").value = "";
  /* los cargos solo tienen sentido si la planta configuró facturación */
  $("extra-row").hidden = !etBillingReady(cfg);
  etNow();
  etSuggestTicket();
  $("f-truck").focus();
}

/* ------------------------------------------------------------ generar */
function etGenerate() {
  const ticket = val("f-ticket");
  const company = cfg.company;
  const truck = val("f-truck");
  const vol = num(val("f-vol"));
  const plant = val("f-plant");

  if (!ticket) { toast("Falta el número de conduce", true); $("f-ticket").focus(); return; }
  if (!truck) { toast("Falta el número de camión", true); $("f-truck").focus(); return; }
  if (!vol || vol <= 0) { toast("Volumen inválido", true); $("f-vol").focus(); return; }

  if (EtDatos.existeConduce(company, ticket)) {
    toast(`El conduce ${ticket} de ${company} ya existe`, true);
    return;
  }

  const origin = {
    ticket, company, plant: plant || null, truck,
    vol, mix: val("f-mix") || null, batch: val("f-batch") || nowHM(),
    extra: num(val("f-extra")), extraLabel: val("f-extra-label") || null,
  };

  let rec;
  try { rec = EtDatos.crear(origin); }
  catch (e) { console.error(e); toast("No se pudo guardar el conduce", true); return; }

  etAdvanceCounter(ticket);
  etShowSlip(rec);
  etRender();
  toast(`Conduce ${ticket} generado`);
  $("f-truck").value = "";
  $("f-extra").value = "";
  $("f-extra-label").value = "";
  etSuggestTicket();
  etNow();
}

/* ------------------------------------------------------------ QR
   Nivel M por defecto; si el contenido obliga a una versión muy densa
   se baja a L para que los módulos impresos sigan siendo gruesos. */
function etQRSVG(text) {
  let m;
  try {
    m = QR.encode(text, { ecl: "M" });
    if (m.version > 8) m = QR.encode(text, { ecl: "L" });
  } catch (e) {
    console.error("QR:", e);
    return `<div style="font:8pt sans-serif;color:#900">QR no disponible</div>`;
  }
  return QR.toSVG(text, { matrix: m, quiet: 3 });
}

/* ------------------------------------------------------------ hojita del ticket */
const SLIP_LOGO = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="40" height="40" rx="9" fill="none" stroke="#111" stroke-width="11"/>
  <rect x="8" y="60" width="26" height="26" rx="6" fill="none" stroke="#111" stroke-width="11"/>
  <rect x="60" y="8" width="26" height="26" rx="6" fill="none" stroke="#111" stroke-width="11"/>
  <rect x="60" y="52" width="13" height="13" fill="#111"/><rect x="79" y="73" width="13" height="13" fill="#111"/>
</svg>`;

/* URL que va dentro del QR.
   El contrato produce la URL con el resumen del conduce en el fragmento (#).
   e-Ticket le añade lo suyo: fecha y tarifas, para que la página del cliente
   pueda armar la factura sin conocer la configuración de la planta.
   El fragmento nunca viaja al servidor. */
function etQRUrl(t) {
  let url = C.encodeQR({
    ticket: t.ticket, company: t.company, plant: t.plant,
    truck: t.truck, vol: t.vol, mix: t.mix, batch: t.batch,
  }, cfg.publicUrl);
  const b = etBilling(cfg);
  const add = [];
  if (t.date) add.push("dt=" + encodeURIComponent(t.date));
  if (b.price) add.push("pr=" + b.price);
  if (b.tripFee) add.push("tf=" + b.tripFee);
  if (b.taxPct) add.push("tx=" + b.taxPct);
  if (t.extra) add.push("ex=" + t.extra);
  if (t.extraLabel) add.push("xl=" + encodeURIComponent(t.extraLabel));
  return add.length ? url + "&" + add.join("&") : url;
}

function etSlipHTML(t) {
  const payload = etQRUrl(t);
  const row = (k, v) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`;
  return `
<div class="slip" id="slip">
  <div class="brandrow">
    ${SLIP_LOGO}
    <div>
      <div class="bname">${esc(t.company || "—")}</div>
      <div class="bsub">Conduce de hormigón · e-Ticket</div>
    </div>
  </div>

  <div class="huge">
    <div class="k">Conduce</div>
    <div class="v">${esc(t.ticket)}</div>
  </div>

  <table>
    ${row("Camión", t.truck || "—")}
    ${row("Planta", t.plant || "—")}
    ${row("Volumen", (t.vol != null ? fmt(t.vol, 2) : "—") + " CY")}
    ${row("Mezcla", t.mix || "—")}
    ${row("Cargado", t.batch || "—")}
    ${row("Fecha", fmtDateLong(t.date))}
  </table>

  <div class="qrbox">
    ${etQRSVG(payload)}
    <div class="qrcap">${cfg.publicUrl ? "Escanee para ver y pagar" : "Escanee al recibir"}</div>
  </div>

  <div class="cut"></div>
  <div class="foot">
    ${cfg.publicUrl
      ? `Escanee el código con la cámara de su teléfono para ver el detalle de esta entrega y pagar.`
      : `Entregue este ticket al recibir el hormigón.`}<br>
    Conduce ${esc(C.keyOf(t.company, t.ticket))}
  </div>
</div>`;
}
function etShowSlip(t) {
  $("slip-host").innerHTML = etSlipHTML(t);
  $("slip-sheet").classList.add("show");
}
function etCloseSlip() { $("slip-sheet").classList.remove("show"); }
function etReprint(key) {
  const t = EtDatos.buscarPorLlave(key);
  if (t) etShowSlip(t);
}

/* ------------------------------------------------------------ panel del día */
function etTodayRows() {
  const today = todayISO();
  return etConduces()
    .filter((t) => t.source === "eticket" && t.date === today && (t.company || "—") === cfg.company)
    .sort((a, b) => String(b.batch || "").localeCompare(String(a.batch || "")) || (b.n || 0) - (a.n || 0));
}
function etRenderStats(rows) {
  const cy = rows.reduce((a, t) => a + (num(t.vol) || 0), 0);
  const st = rows.map(etStatus);
  const rec = st.filter((s) => s.k !== "desp").length;
  const res = st.filter((s) => s.k === "ok").length;
  const rej = st.filter((s) => s.k === "rej").length;
  const box = (v, k, cls) => `<div class="stat ${cls || ""}"><div class="v">${v}</div><div class="k">${k}</div></div>`;
  $("stats").innerHTML =
    box(rows.length, "camiones") +
    box(fmt(cy, 1), "CY producidas") +
    box(res, "con resultado", res ? "ok" : "") +
    box(rej, "rechazados", rej ? "rej" : "");
}
function etQualityLine(t) {
  const bits = [];
  if (t.slump != null) bits.push(`Rev ${fmt(num(t.slump), 2)}"`);
  if (t.air != null) bits.push(`Aire ${fmt(num(t.air), 1)}%`);
  if (t.uw != null) bits.push(`PU ${fmt(num(t.uw), 1)}`);
  if (t.temp != null) bits.push(`${fmt(num(t.temp), 0)}°F`);
  if (t.cs5 != null) bits.push(`${fmt(num(t.cs5), 0)} psi`);
  return bits.join(" · ");
}
function etRenderList(rows) {
  $("list-count").textContent = rows.length ? `${rows.length} hoy` : "";
  if (!rows.length) {
    $("list").innerHTML = `<div class="empty">Todavía no se ha generado ningún ticket hoy.<br>Carga un camión y presiona <b>Generar ticket</b>.</div>`;
    return;
  }
  $("list").innerHTML = rows.map((t) => {
    const s = etStatus(t);
    const q = etQualityLine(t);
    const key = C.keyOf(t.company, t.ticket);
    return `<div class="row" onclick="etReprint('${esc(key).replace(/'/g, "\\'")}')" title="Ver / reimprimir ticket">
      <div class="tk">${esc(t.ticket)}</div>
      <div class="meta">Camión <b>${esc(t.truck || "—")}</b> · ${esc(fmt(num(t.vol), 2))} CY · ${esc(t.batch || "—")}
        ${q ? `<br>${esc(q)}` : ""}</div>
      <div class="chip c-${s.k}">${s.label}</div>
    </div>`;
  }).join("");
}
function etRender() {
  const rows = etTodayRows();
  etRenderStats(rows);
  etRenderList(rows);
}

/* ------------------------------------------------------------ arranque */
function etClock() {
  $("clock").textContent = nowHM();
  $("today").textContent = fmtDateLong(todayISO());
}
function etInit() {
  if (!C) { document.body.innerHTML = "<p style='padding:40px;font:16px sans-serif'>Falta shared/conduce-contract.js</p>"; return; }
  etApplyTheme(localStorage.getItem(THEME_KEY) || "dark");

  /* Sin configuración no se despacha: al setup. */
  cfg = etRequireConfig();
  if (!cfg) return;
  etApplyPaper(cfg.paper);

  etStoreMissing = !etReadStore();
  if (etStoreMissing) {
    const w = $("warn");
    w.hidden = false;
    w.textContent = "No hay base de conduces en este navegador todavía. El primer ticket la crea.";
  }

  etResetForm();
  etClock(); setInterval(etClock, 15000);
  etRender();

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") etCloseSlip();
    if (e.key === "Enter" && !$("slip-sheet").classList.contains("show")
        && document.activeElement && document.activeElement.tagName === "INPUT") etGenerate();
  });
  /* otra ventana (QCheck) escribió: refrescar estados en vivo */
  window.addEventListener("storage", (e) => {
    if (EtDatos.esNuestraClave(e.key)) { if ($("warn")) $("warn").hidden = true; etRender(); }
    if (e.key === THEME_KEY && e.newValue) etApplyTheme(e.newValue);
  });
}
document.addEventListener("DOMContentLoaded", etInit);
