/* ============================================================
   e-Ticket — Tablero de producción de la planta.

   Solo lectura: esta pantalla nunca escribe en el almacén.
   Muestra lo que la planta produjo y la calidad que el laboratorio
   devolvió sobre SUS camiones.

   PRIVACIDAD: la planta no ve información del proyecto. Aquí no se
   lee ni se muestra `ident`, `lot`, contrato, estación ni losa,
   aunque el record los tenga.
   ============================================================ */
"use strict";

const C = window.ConduceContract;
const THEME_KEY = "eticket-theme";
let cfg = null;

const $ = (id) => document.getElementById(id);
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
function fmtDateLong(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-PR", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}
function minutesBetween(a, b) {
  if (!a || !b) return null;
  const [h1, m1] = String(a).split(":").map(Number), [h2, m2] = String(b).split(":").map(Number);
  if ([h1, m1, h2, m2].some((v) => !Number.isFinite(v))) return null;
  let d = h2 * 60 + m2 - (h1 * 60 + m1);
  if (d < 0) d += 1440;
  return d;
}
function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
function sd(a) {
  if (a.length < 2) return null;
  const m = avg(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}

/* ------------------------------------------------------------ tema */
const ICON_SUN = `<svg viewBox="0 0 24 24" style="width:56%;height:56%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.3"/><path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5"/></svg>`;
const ICON_MOON = `<svg viewBox="0 0 24 24" style="width:54%;height:54%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 14.5A8.6 8.6 0 0 1 9.5 3.8a8.6 8.6 0 1 0 10.7 10.7z"/></svg>`;
function pdApplyTheme(t) {
  document.documentElement.dataset.theme = t;
  const b = $("theme-toggle");
  if (b) { b.innerHTML = t === "dark" ? ICON_SUN : ICON_MOON; b.title = t === "dark" ? "Modo claro" : "Modo oscuro"; }
}
function pdToggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next); pdApplyTheme(next);
}

/* ------------------------------------------------------------ datos (solo lectura) */
function pdReadStore() {
  try {
    const raw = localStorage.getItem(C.STORE_KEY);
    if (raw) { const s = JSON.parse(raw); if (s && Array.isArray(s.tests)) return s; }
  } catch (e) { console.error("Producción: base local ilegible", e); }
  return null;
}
/* La planta solo ve lo suyo: se filtra por la compañía de su configuración. */
function pdRows() {
  const s = pdReadStore();
  if (!s) return [];
  return s.tests.filter((t) => (t.company || "—") === cfg.company);
}

/* ------------------------------------------------------------ especificación (contrato v3)
   Los límites los PUBLICA QCheck; la planta solo los LEE. Salen del diseño de
   mezcla aprobado del proyecto, no de la planta: si cada concretera entrara los
   suyos, podría creerse en rango mientras QC la rechaza.
   Si QC todavía no publicó, se muestra el número SIN colorear. Nunca se inventan
   límites ni se ofrecen en el setup. */
function pdSpecOf(store, mixId) { return C.readMixSpec(store, mixId); }
function pdZone(spec, field, value) { return C.zoneAgainstSpec(spec, field, value); }

/* Límites de un campo, en el espacio del valor, para dibujar las bandas. */
function pdBands(spec, field) {
  if (!spec) return null;
  if (field === "temp") {
    if (spec.tempMax == null) return null;
    return { target: null, actLo: null, actHi: spec.tempMax - 3, suspLo: null, suspHi: spec.tempMax };
  }
  if (field === "uw") {
    const t = spec.uw && spec.uw.target;
    if (t == null) return null;
    return { target: t, actLo: t - spec.uw.act, actHi: t + spec.uw.act,
             suspLo: t - spec.uw.susp, suspHi: t + spec.uw.susp };
  }
  const s = spec[field];
  if (!s) return null;
  return { target: s.target, actLo: s.actLo, actHi: s.actHi, suspLo: s.suspLo, suspHi: s.suspHi };
}
function pdLimitText(b, dp, unit) {
  if (!b) return "";
  const n = (v) => fmt(v, dp) + unit;
  if (b.actLo == null && b.actHi != null) return `máx ${n(b.suspHi)} · acción sobre ${n(b.actHi)}`;
  if (b.actLo == null || b.actHi == null) return "";
  return `acción ${n(b.actLo)}–${n(b.actHi)} · límite ${n(b.suspLo)}–${n(b.suspHi)}`;
}

/* ------------------------------------------------------------ estado del conduce */
const RESULT_FIELDS = ["slump", "air", "uw", "temp", "cs1", "cs5", "cs28"];
function pdStatus(t) {
  if (t.rejected === true) return { k: "rej", label: "Rechazado", cls: "c-rej" };
  if (RESULT_FIELDS.some((f) => t[f] != null)) return { k: "ok", label: "Resultado", cls: "c-ok" };
  if (t.arrive || t.start || t.end || t.testTime) return { k: "rec", label: "Recibido", cls: "c-rec" };
  return { k: "desp", label: "En ruta", cls: "c-desp" };
}

/* ------------------------------------------------------------ selectores */
function pdFillPickers(all) {
  /* Las plantas salen de la configuración, no del histórico. */
  const sel = $("p-plant");
  const keep = sel.value;
  sel.innerHTML = `<option value="">Todas las plantas</option>` +
    cfg.plants.map((p) => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("");
  if (keep) sel.value = keep;

  /* La lista de días se reconstruye en cada render: si otra ventana despacha
     un camión hoy, el día de hoy tiene que aparecer sin recargar la página. */
  const days = [...new Set(all.map((t) => t.date).filter(Boolean))].sort().reverse();
  const dsel = $("p-day");
  const prev = dsel.value;
  dsel.innerHTML = days.map((d) => `<option value="${d}">${esc(fmtDateLong(d))}</option>`).join("");
  if (prev && days.includes(prev)) dsel.value = prev;
  else dsel.value = days.includes(todayISO()) ? todayISO() : (days[0] || "");
}

/* ------------------------------------------------------------ tarjetas de calidad */
function sparkline(pts, bands) {
  if (pts.length < 2) return "";
  const W = 260, H = 56, P = 6;
  const vals = pts.map((p) => p.v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  /* la escala abarca también los límites de acción: si no, las bandas
     quedan fuera del dibujo y la planta no ve cuánto le falta */
  if (bands) {
    for (const v of [bands.actLo, bands.actHi, bands.target]) {
      if (v == null) continue;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
  }
  if (hi === lo) { hi += 0.5; lo -= 0.5; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const X = (i) => P + i * (W - P * 2) / (pts.length - 1);
  const Y = (v) => P + (hi - v) / (hi - lo) * (H - P * 2);
  const clamp = (y) => Math.max(0, Math.min(H, y));

  let bg = "";
  if (bands) {
    /* zona roja: por encima del límite superior y por debajo del inferior */
    if (bands.suspHi != null) bg += `<rect class="b-susp" x="0" y="0" width="${W}" height="${clamp(Y(bands.suspHi)).toFixed(1)}"/>`;
    if (bands.suspLo != null) { const y = clamp(Y(bands.suspLo)); bg += `<rect class="b-susp" x="0" y="${y.toFixed(1)}" width="${W}" height="${(H - y).toFixed(1)}"/>`; }
    /* zona ámbar: entre acción y límite */
    if (bands.actHi != null) { const y0 = bands.suspHi != null ? clamp(Y(bands.suspHi)) : 0; const y1 = clamp(Y(bands.actHi)); if (y1 > y0) bg += `<rect class="b-act" x="0" y="${y0.toFixed(1)}" width="${W}" height="${(y1 - y0).toFixed(1)}"/>`; }
    if (bands.actLo != null) { const y0 = clamp(Y(bands.actLo)); const y1 = bands.suspLo != null ? clamp(Y(bands.suspLo)) : H; if (y1 > y0) bg += `<rect class="b-act" x="0" y="${y0.toFixed(1)}" width="${W}" height="${(y1 - y0).toFixed(1)}"/>`; }
    if (bands.target != null) bg += `<line class="b-target" x1="0" y1="${clamp(Y(bands.target)).toFixed(1)}" x2="${W}" y2="${clamp(Y(bands.target)).toFixed(1)}"/>`;
  }
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  const dots = pts.map((p, i) =>
    `<circle class="dt${p.z ? " z-" + p.z : ""}${p.rej ? " rj" : ""}" cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${p.rej || p.z === "susp" ? 3 : 2.2}"/>`).join("");
  return `<svg class="spark${bands ? " has-spec" : ""}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${bg}<path class="ln" d="${line}"/>${dots}</svg>`;
}

/* Aviso de tendencia: lo que Rubén pidió — que avise ANTES de seguir
   produciendo fuera de rango, no después. */
function pdTrendAlert(def, spec, bands, last, delta) {
  const zLast = pdZone(spec, def.key, last);
  if (zLast === "susp") return { cls: "a-susp", txt: "fuera de límite" };
  if (zLast === "act") return { cls: "a-act", txt: "en zona de acción" };
  if (!spec || delta == null || Math.abs(delta) < def.flat) return null;
  /* proyecta el próximo movimiento del mismo tamaño */
  const zNext = pdZone(spec, def.key, last + delta);
  if (zNext === "act" || zNext === "susp") return { cls: "a-act", txt: "acercándose al límite" };
  void bands;
  return null;
}

function qualityCard(def, rows, store) {
  const pts = rows.filter((t) => num(t[def.key]) != null).map((t) => {
    const spec = pdSpecOf(store, t.mix);
    return { v: num(t[def.key]), rej: t.rejected === true, spec, z: pdZone(spec, def.key, num(t[def.key])) };
  });
  if (!pts.length) {
    return `<div class="qcard"><div class="qhead"><div class="qk">${def.label}</div></div>
      <div class="qval">—</div><div class="qsub">el laboratorio todavía no devuelve datos</div></div>`;
  }
  const vals = pts.map((p) => p.v);
  const last = vals[vals.length - 1];
  const m = avg(vals), s = sd(vals);

  /* Bandas solo si todas las cargas del día comparten una misma especificación
     publicada; con mezclas distintas los límites no son comparables en un gráfico. */
  const specs = [...new Set(pts.map((p) => (p.spec ? p.spec.mix : null)))];
  const oneSpec = specs.length === 1 && specs[0] != null ? pts[pts.length - 1].spec : null;
  const bands = pdBands(oneSpec, def.key);
  const lastSpec = pts[pts.length - 1].spec;
  const zLast = pdZone(lastSpec, def.key, last);

  /* tendencia: media de las últimas 3 cargas contra las 3 anteriores */
  let trend = "", delta = null;
  if (vals.length >= 4) {
    const a = avg(vals.slice(-3)), b = avg(vals.slice(-6, -3));
    if (b != null) {
      delta = a - b;
      const cls = Math.abs(delta) < def.flat ? "t-flat" : delta > 0 ? "t-up" : "t-down";
      const arrow = Math.abs(delta) < def.flat ? "sin cambio"
        : (delta > 0 ? "▲ " : "▼ ") + fmt(Math.abs(delta), def.dp) + def.unit;
      trend = `<div class="qtrend ${cls}">${arrow}</div>`;
    }
  }
  const alert = pdTrendAlert(def, lastSpec, bands, last, delta);
  const limits = pdLimitText(bands, def.dp, def.unit);

  return `<div class="qcard${zLast ? " z-" + zLast : ""}">
    <div class="qhead"><div class="qk">${def.label}</div>${trend}</div>
    <div class="qval${zLast ? " z-" + zLast : ""}">${fmt(last, def.dp)}<s>${def.unit}</s></div>
    <div class="qsub">promedio ${fmt(m, def.dp)}${def.unit} · σ ${s == null ? "—" : fmt(s, def.dp + 1)} ·
      rango ${fmt(Math.min(...vals), def.dp)}–${fmt(Math.max(...vals), def.dp)} · ${vals.length} cargas</div>
    ${limits ? `<div class="qlim">${esc(limits)}</div>`
             : `<div class="qlim nospec">límites no publicados</div>`}
    ${alert ? `<div class="qalert ${alert.cls}">${alert.txt}</div>` : ""}
    ${sparkline(pts, bands)}
  </div>`;
}

/* ------------------------------------------------------------ render */
const Q_DEFS = [
  { key: "slump", label: "Revenimiento", unit: '"', dp: 2, flat: 0.15 },
  { key: "uw", label: "Peso unitario", unit: " pcf", dp: 1, flat: 0.3 },
  { key: "temp", label: "Temperatura", unit: "°F", dp: 0, flat: 0.8 },
];

function pdRender() {
  const store = pdReadStore();
  const all = pdRows();
  pdFillPickers(all);

  const day = $("p-day").value;
  const plant = $("p-plant").value;
  const isToday = day === todayISO();
  const rows = all.filter((t) => t.date === day && (!plant || t.plant === plant))
    .sort((a, b) => String(a.batch || "").localeCompare(String(b.batch || "")) || (a.n || 0) - (b.n || 0));

  /* ---- KPIs ---- */
  const cy = rows.reduce((a, t) => a + (num(t.vol) || 0), 0);
  const st = rows.map(pdStatus);
  const enRuta = st.filter((s) => s.k === "desp").length;
  const conRes = st.filter((s) => s.k === "ok").length;
  const rech = st.filter((s) => s.k === "rej").length;
  const kpi = (v, unit, k, cls) =>
    `<div class="kpi ${cls || ""}"><div class="v">${v}${unit ? `<s>${unit}</s>` : ""}</div><div class="k">${k}</div></div>`;
  $("kpis").innerHTML =
    kpi(rows.length, "", "camiones despachados", "brand") +
    kpi(fmt(cy, 1), "CY", "volumen producido", "brand") +
    kpi(enRuta, "", isToday ? "en ruta" : "sin recibir", enRuta ? "info" : "") +
    kpi(conRes, "", "con resultado", conRes ? "ok" : "") +
    kpi(rech, "", "rechazados", rech ? "rej" : "");

  /* ---- ritmo ---- */
  const times = rows.map((t) => t.batch).filter(Boolean).sort();
  const span = times.length > 1 ? minutesBetween(times[0], times[times.length - 1]) : null;
  const hours = span ? span / 60 : null;
  const gaps = [];
  for (let i = 1; i < times.length; i++) { const g = minutesBetween(times[i - 1], times[i]); if (g != null) gaps.push(g); }
  const line = (k, v, u) => `<div class="line"><div class="lk">${k}</div><div class="lv">${v}${u ? `<s>${u}</s>` : ""}</div></div>`;
  $("rate").innerHTML =
    line("Primera carga", times[0] || "—", "") +
    line("Última carga", times[times.length - 1] || "—", "") +
    line("Ventana de producción", hours ? fmt(hours, 1) : "—", hours ? "h" : "") +
    line("Ritmo", hours ? fmt(cy / hours, 1) : "—", hours ? "CY/h" : "") +
    line("Cargas por hora", hours ? fmt(rows.length / hours, 1) : "—", "") +
    line("Intervalo entre cargas", gaps.length ? fmt(avg(gaps), 0) : "—", gaps.length ? "min" : "") +
    line("Volumen por carga", rows.length ? fmt(cy / rows.length, 1) : "—", rows.length ? "CY" : "");

  /* ---- ciclos ---- */
  const leg = (a, b) => rows.map((t) => minutesBetween(t[a], t[b])).filter((v) => v != null);
  const ruta = leg("batch", "arrive"), espera = leg("arrive", "start");
  const desc = leg("start", "end"), total = leg("batch", "end");
  const legLine = (k, arr) =>
    line(k, arr.length ? fmt(avg(arr), 0) : "—", arr.length ? `min · ${arr.length} camiones` : "");
  $("cycle").innerHTML =
    legLine("Planta → obra", ruta) +
    legLine("Espera en obra", espera) +
    legLine("Descarga", desc) +
    legLine("Ciclo completo", total) +
    line("Ciclo más largo", total.length ? fmt(Math.max(...total), 0) : "—", total.length ? "min" : "");

  /* ---- calidad devuelta ---- */
  $("quality").innerHTML = Q_DEFS.map((d) => qualityCard(d, rows, store)).join("");
  const hayResultados = rows.some((t) => RESULT_FIELDS.some((f) => t[f] != null));
  const haySpec = rows.some((t) => pdSpecOf(store, t.mix));
  $("qnote").innerHTML = !hayResultados
    ? "Todavía no hay resultados del laboratorio para este día."
    : "Valores medidos por el laboratorio en obra sobre camiones de esta planta. La dispersión (σ) es la uniformidad de la producción; la tendencia compara las últimas 3 cargas con las 3 anteriores. " +
      (haySpec
        ? "Los <b>límites vienen del diseño de mezcla aprobado del proyecto</b>, publicados por el laboratorio: verde dentro, ámbar en zona de acción, rojo fuera."
        : "El laboratorio <b>todavía no ha publicado los límites</b> de estas mezclas, así que los valores se muestran sin evaluar.");

  /* ---- tabla de camiones (sin un solo dato del proyecto) ---- */
  if (!rows.length) {
    $("trucks").innerHTML = `<tr><td style="border:none;color:var(--muted);padding:16px 0">Sin camiones para este día.</td></tr>`;
    return;
  }
  const head = ["Conduce", "Camión", "Planta", "CY", "Cargado", "Llegada", "Ciclo", "Rev.", "P.U.", "Temp.", "Estado"];
  $("trucks").innerHTML =
    `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>` +
    rows.map((t) => {
      const s = pdStatus(t);
      const c = minutesBetween(t.batch, t.end);
      const spec = pdSpecOf(store, t.mix);
      /* cada lectura se evalúa contra la especificación de SU propia mezcla */
      const cell = (field, dp) => {
        const v = num(t[field]);
        if (v == null) return `<td>—</td>`;
        const z = pdZone(spec, field, v);
        return `<td class="${z ? "z-" + z : ""}">${fmt(v, dp)}</td>`;
      };
      return `<tr class="${t.rejected ? "rej" : ""}">
        <td class="n">${esc(t.ticket || "—")}</td>
        <td>${esc(t.truck || "—")}</td>
        <td>${esc(t.plant || "—")}</td>
        <td>${fmt(num(t.vol), 2)}</td>
        <td>${esc(t.batch || "—")}</td>
        <td>${esc(t.arrive || "—")}</td>
        <td>${c == null ? "—" : fmt(c, 0) + " min"}</td>
        ${cell("slump", 2)}${cell("uw", 1)}${cell("temp", 0)}
        <td class="st ${s.cls}">${s.label}</td>
      </tr>`;
    }).join("") + "</tbody>";
}

/* ------------------------------------------------------------ arranque */
function pdInit() {
  if (!C) { document.body.innerHTML = "<p style='padding:40px;font:16px sans-serif'>Falta shared/conduce-contract.js</p>"; return; }
  pdApplyTheme(localStorage.getItem(THEME_KEY) || "dark");

  cfg = etRequireConfig();
  if (!cfg) return;
  document.querySelector(".hsub").textContent = cfg.company;

  pdRender();

  window.addEventListener("storage", (e) => {
    if (e.key === C.STORE_KEY) pdRender();
    if (e.key === THEME_KEY && e.newValue) pdApplyTheme(e.newValue);
  });
}
document.addEventListener("DOMContentLoaded", pdInit);
