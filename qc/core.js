/* ============================================================
   QC core — shared engine for every role screen.
   Storage, SPC zones, derived data, SVG charts, forms, sync.
   Load order on every page: seed.js → core.js → page script.
   ============================================================ */
"use strict";

const DB_KEY = "qc-pr52-db-v1";
let db;

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) { db = JSON.parse(raw); migrateDB(); return; }
  } catch (e) { console.error(e); }
  db = {
    version: 2,
    project: structuredClone(QC_SEED.project),
    plan: structuredClone(QC_SEED.plan),
    tests: structuredClone(QC_SEED.tests),
    dayMeta: {},
    humidity: [],
  };
  migrateDB();
  saveDB();
}
/* Esquema v2: record por conduce (compañía + número), humedades, plan del día */
function migrateDB() {
  if (!db.humidity) db.humidity = [];
  if (!db.dayMeta) db.dayMeta = {};
  if (!db.plan.humidityMaxHours) db.plan.humidityMaxHours = 3;
  for (const t of db.tests) {
    if (!t.company) t.company = plantCompany(t.plant);   // clave: compañía + conduce
    if (!t.source) t.source = "excel";                    // qr | ocr | manual | excel
  }
  db.version = 2;
}
/* La compañía sale de la planta cuando no viene declarada (histórico) */
function plantCompany(plant) {
  if (!plant) return "—";
  return /san juan|gurabo/i.test(plant) ? "Concretec" : String(plant).replace(/^\d+\s*-\s*/, "");
}
/* Clave única del conduce: nunca chocan tickets de plantas distintas */
function conduceKey(t) { return (t.company || "—") + "·" + (t.ticket || "?"); }
function findConduce(company, ticket) {
  return db.tests.find((t) => conduceKey(t) === (company || "—") + "·" + ticket) || null;
}
/* QCheck es la fuente de verdad de los límites: los publica en cada guardado
   para que la planta (e-Ticket) pueda colorear sus lecturas sin inventarlos.
   Contrato v3 — ver shared/conduce-contract.js */
function publishSpec() {
  const C = typeof window !== "undefined" && window.ConduceContract;
  if (C && C.publishMixSpec) {
    try { C.publishMixSpec(db, db.project && db.project.mixId, db.plan); } catch (_) {}
  }
}
function saveDB() { publishSpec(); localStorage.setItem(DB_KEY, JSON.stringify(db)); }

/* Cross-window live sync: other open role screens re-render when
   any window writes the DB (storage events fire cross-tab).     */
function enableLiveSync(onChange) {
  window.addEventListener("storage", (e) => {
    if (e.key === DB_KEY && e.newValue) {
      try { db = JSON.parse(e.newValue); if (!db.dayMeta) db.dayMeta = {}; onChange(); } catch (_) {}
    }
  });
}

/* ------------------------------------------------------------ theme (light/dark)
   One key shared by every screen; each page passes its own default.
   Changing it in one window updates the others live.             */
const THEME_KEY = "qc-theme";
/* silhouette icons (stroke, currentColor) */
const ICON_SUN = `<svg viewBox="0 0 24 24" style="width:58%;height:58%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.3"/><path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5"/></svg>`;
const ICON_MOON = `<svg viewBox="0 0 24 24" style="width:56%;height:56%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 14.5A8.6 8.6 0 0 1 9.5 3.8a8.6 8.6 0 1 0 10.7 10.7z"/></svg>`;
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const b = document.getElementById("theme-toggle");
  if (b) { b.innerHTML = t === "dark" ? ICON_SUN : ICON_MOON; b.title = t === "dark" ? "Modo claro" : "Modo oscuro"; }
}
function initTheme(def = "light") {
  applyTheme(localStorage.getItem(THEME_KEY) || def);
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY && e.newValue) applyTheme(e.newValue);
  });
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}
function mountThemeToggle() {
  const b = document.createElement("button");
  b.id = "theme-toggle";
  b.className = "theme-toggle";
  b.title = "Modo claro / oscuro";
  b.onclick = (e) => { e.stopPropagation(); toggleTheme(); };
  document.body.appendChild(b);
  applyTheme(document.documentElement.dataset.theme || "light");
}

/* ------------------------------------------------------------ helpers */
function uid() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); }
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function num(v) { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function fmt(n, dp = 1) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: dp });
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function nowHM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function parseDate(iso) { if (!iso) return null; const [y, m, dd] = iso.split("-").map(Number); return new Date(y, m - 1, dd); }
function fmtDate(iso) {
  const d = parseDate(iso); if (!d) return "—";
  return d.toLocaleDateString("es-PR", { year: "numeric", month: "short", day: "numeric" });
}
function minutesBetween(t1, t2) {
  if (!t1 || !t2) return null;
  const [h1, m1] = t1.split(":").map(Number), [h2, m2] = t2.split(":").map(Number);
  let diff = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diff < 0) diff += 1440;
  return diff;
}
function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ------------------------------------------------------------ SPC zones */
function zoneRange(v, actLo, actHi, suspLo, suspHi) {
  if (v == null) return null;
  if (v < suspLo || v > suspHi) return "susp";
  if (v < actLo || v > actHi) return "act";
  return "ok";
}
function zoneSlump(t) { const p = db.plan.slump; return zoneRange(num(t.slump), p.actLo, p.actHi, p.suspLo, p.suspHi); }
function zoneAir(t)   { const p = db.plan.air;   return zoneRange(num(t.air),   p.actLo, p.actHi, p.suspLo, p.suspHi); }
function zoneUW(t) {
  const p = db.plan.uw;
  const target = num(t.uwTarget) ?? p.target;
  return zoneRange(num(t.uw), target - p.act, target + p.act, target - p.susp, target + p.susp);
}
function zoneTemp(t) {
  const v = num(t.temp); if (v == null) return null;
  if (v > db.plan.tempMax) return "susp";
  if (v > db.plan.tempMax - 3) return "act";
  return "ok";
}
function zoneCS5(v) {
  if (v == null) return null;
  const p = db.plan.cs;
  if (v < p.action) return "susp";
  if (v < p.target) return "act";
  return "ok";
}
function zoneElapsed(t) {
  const el = minutesBetween(t.batch, t.end);
  if (el == null) return null;
  return el > db.plan.maxElapsedMin ? "susp" : "ok";
}
const Z_ORDER = { susp: 3, act: 2, ok: 1 };
function worstZone(t) {
  let w = null;
  for (const z of [zoneSlump(t), zoneAir(t), zoneUW(t), zoneTemp(t)]) {
    if (z && (!w || Z_ORDER[z] > Z_ORDER[w])) w = z;
  }
  return w;
}
function estadoBadge(t) {
  if (t.rejected) return `<span class="badge susp">RECHAZADO</span>`;
  const w = worstZone(t);
  if (w === "susp") return `<span class="badge susp">FUERA DE LÍMITE</span>`;
  if (w === "act") return `<span class="badge act">ACCIÓN</span>`;
  if (w === "ok") return `<span class="badge ok">OK</span>`;
  return `<span class="badge neutral">—</span>`;
}
function zClass(z) { return z ? ` class="num z-${z}"` : ` class="num"`; }

/* ------------------------------------------------------------ derived */
function sortedTests() { return [...db.tests].sort((a, b) => a.n - b.n); }
function testDates() { return [...new Set(db.tests.map((t) => t.date))].sort().reverse(); }
function testsOfDate(d) { return sortedTests().filter((t) => t.date === d); }
function nextTestN() { return db.tests.length ? Math.max(...db.tests.map((t) => t.n)) + 1 : 1; }
function shortIdent(s) {
  if (!s) return "—";
  return String(s).replace(/^Phase\s+(\d+)\s*-\s*/i, "F$1 · ").replace(/SLAB\s*/i, "");
}
function strengthSets() {
  const sets = sortedTests().filter((t) => t.cs1 != null || t.cs5 != null || t.cs28 != null);
  const w = db.plan.maWindow;
  const cs5s = [];
  for (const s of sets) {
    s._ma5 = null;
    if (s.cs5 != null) {
      cs5s.push(s.cs5);
      if (cs5s.length >= w) s._ma5 = cs5s.slice(-w).reduce((a, b) => a + b, 0) / w;
    }
  }
  return sets;
}

/* Day-level production stats (producer / contractor KPIs). */
function dayStats(day) {
  const rows = testsOfDate(day);
  const cy = rows.reduce((a, t) => a + (num(t.vol) || 0), 0);
  const cycles = rows.map((t) => minutesBetween(t.batch, t.end)).filter((x) => x != null);
  const waits = rows.map((t) => minutesBetween(t.arrive, t.start)).filter((x) => x != null);
  const starts = rows.map((t) => t.start || t.arrive).filter(Boolean).sort();
  const ends = rows.map((t) => t.end || t.testTime).filter(Boolean).sort();
  let hours = null;
  if (starts.length && ends.length) {
    const span = minutesBetween(starts[0], ends[ends.length - 1]);
    if (span != null && span > 0) hours = span / 60;
  }
  return {
    rows, cy, loads: rows.length,
    rejected: rows.filter((t) => t.rejected).length,
    cyPerHr: hours ? cy / hours : null,
    loadsPerHr: hours ? rows.length / hours : null,
    avgCycle: cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null,
    maxCycle: cycles.length ? Math.max(...cycles) : null,
    avgWait: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null,
    firstStart: starts[0] || null, lastEnd: ends[ends.length - 1] || null, hours,
  };
}

/* ------------------------------------------------------------ plan del día / losas
   El contratista necesita: yardas colocadas y pendientes, camiones esperando,
   progreso del tiro y cuántas losas lleva de las planificadas.          */

/* Extrae códigos de losa del texto de identificación: "L3-0.936 to L3-0.929" → 2 */
function slabCodes(ident) {
  if (!ident) return [];
  const m = String(ident).match(/L\s?\d+\s?-\s?\d+\.\d+/gi);
  return m ? m.map((s) => s.replace(/\s+/g, "").toUpperCase()) : [];
}

/* Camión "esperando": llegó, no fue rechazado y todavía no terminó de descargar */
function trucksWaiting(day) {
  return testsOfDate(day).filter((t) => t.arrive && !t.end && !t.rejected);
}
function trucksDischarging(day) {
  return testsOfDate(day).filter((t) => t.start && !t.end && !t.rejected);
}

function dayProgress(day) {
  const meta = db.dayMeta[day] || {};
  const rows = testsOfDate(day);
  const placed = rows.filter((t) => !t.rejected).reduce((a, t) => a + (num(t.vol) || 0), 0);
  const cyPlan = num(meta.cyPlan);
  const losasPlan = num(meta.losasPlan);
  const done = new Set();
  for (const t of rows) if (!t.rejected && t.end) slabCodes(t.ident).forEach((c) => done.add(c));
  const losasDone = done.size;
  const waiting = trucksWaiting(day);
  const evaluated = rows.filter((t) => worstZone(t) != null);
  const conforming = evaluated.filter((t) => !t.rejected && worstZone(t) !== "susp").length;
  return {
    placed,
    cyPlan,
    pending: cyPlan != null ? Math.max(0, cyPlan - placed) : null,
    pct: cyPlan ? Math.min(100, placed / cyPlan * 100) : null,
    losasPlan, losasDone,
    losasPct: losasPlan ? Math.min(100, losasDone / losasPlan * 100) : null,
    waiting, waitingCY: waiting.reduce((a, t) => a + (num(t.vol) || 0), 0),
    discharging: trucksDischarging(day),
    loads: rows.length,
    rejected: rows.filter((t) => t.rejected).length,
    evaluated: evaluated.length, conforming,
    compliancePct: evaluated.length ? conforming / evaluated.length * 100 : null,
  };
}

/* ------------------------------------------------------------ humedades (planta) */
function addHumidity(entry) {
  db.humidity.push({ id: uid(), date: entry.date || todayISO(), time: entry.time || nowHM(),
                     plant: entry.plant || null, note: entry.note || null });
  saveDB();
}
function lastHumidity(day) {
  const list = db.humidity.filter((h) => h.date === (day || todayISO()))
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  return list.length ? list[list.length - 1] : null;
}

/* ------------------------------------------------------------ capa de inteligencia
   Convierte el registro en asesor: detecta tendencias y recomienda acción.
   Reglas derivadas de la práctica de Rubén con la planta.               */
function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }

function trendAlerts(day) {
  const rows = testsOfDate(day).filter((t) => !t.rejected);
  const out = [];
  const uw = rows.filter((t) => num(t.uw) != null);
  const sl = rows.filter((t) => num(t.slump) != null);

  // --- Regla del agua: peso unitario bajando + slump subiendo ---
  if (uw.length >= 6 && sl.length >= 6) {
    const dUW = avg(uw.slice(-3).map((t) => num(t.uw))) - avg(uw.slice(-6, -3).map((t) => num(t.uw)));
    const dSL = avg(sl.slice(-3).map((t) => num(t.slump))) - avg(sl.slice(-6, -3).map((t) => num(t.slump)));
    if (dUW <= -0.8 && dSL >= 0.4) {
      out.push({
        level: "susp", icon: "💧", title: "Posible exceso de agua",
        text: `Peso unitario bajó ${fmt(Math.abs(dUW), 1)} pcf mientras el slump subió ${fmt(dSL, 2)}" en las últimas 3 pruebas.`,
        action: "Avisar a la planta: verificar humedades de los agregados.",
      });
    } else if (dUW >= 0.8 && dSL <= -0.4) {
      out.push({
        level: "act", icon: "🧱", title: "Mezcla secándose",
        text: `Peso unitario subió ${fmt(dUW, 1)} pcf y el slump bajó ${fmt(Math.abs(dSL), 2)}".`,
        action: "Verificar dosificación de agua y humedades en planta.",
      });
    }
  }

  // --- Tendencia sostenida de peso unitario hacia un límite ---
  if (uw.length >= 4) {
    const last = uw.slice(-4).map((t) => num(t.uw));
    const target = num(uw[uw.length - 1].uwTarget) ?? db.plan.uw.target;
    const drift = last[last.length - 1] - last[0];
    const dist = Math.abs(last[last.length - 1] - target);
    const monotonic = last.every((v, i) => i === 0 || v <= last[i - 1]) ||
                      last.every((v, i) => i === 0 || v >= last[i - 1]);
    if (monotonic && Math.abs(drift) >= 1.0 && dist > db.plan.uw.act * 0.6) {
      out.push({
        level: "act", icon: "📉", title: `Peso unitario se está yendo ${drift < 0 ? "hacia abajo" : "hacia arriba"}`,
        text: `4 lecturas seguidas en la misma dirección (${fmt(drift, 1)} pcf). Objetivo ${fmt(target, 1)}.`,
        action: "Avisar a la planta antes de que se salga de límite.",
      });
    }
  }

  // --- Slump acercándose al límite de forma sostenida ---
  if (sl.length >= 4) {
    const last = sl.slice(-4).map((t) => num(t.slump));
    const p = db.plan.slump;
    const rising = last.every((v, i) => i === 0 || v >= last[i - 1]);
    const falling = last.every((v, i) => i === 0 || v <= last[i - 1]);
    if (rising && last[last.length - 1] >= p.actHi - 0.5 && last[last.length - 1] > last[0])
      out.push({ level: "act", icon: "📈", title: "Slump subiendo hacia el límite",
        text: `Última lectura ${fmt(last[last.length - 1], 2)}" (acción ${p.actHi}").`,
        action: "Vigilar próxima descarga; posible agua en el camión." });
    if (falling && last[last.length - 1] <= p.actLo + 0.5 && last[last.length - 1] < last[0])
      out.push({ level: "act", icon: "📉", title: "Slump bajando hacia el límite",
        text: `Última lectura ${fmt(last[last.length - 1], 2)}" (acción ${p.actLo}").`,
        action: "Verificar tiempo de viaje y dosificación." });
  }

  // --- Humedades de planta vencidas ---
  const h = lastHumidity(day);
  const ref = rows.length ? (rows[rows.length - 1].testTime || rows[rows.length - 1].arrive) : null;
  if (rows.length >= 3) {
    if (!h) {
      out.push({ level: "act", icon: "🌡", title: "Sin prueba de humedad registrada hoy",
        text: "No hay registro de humedades de agregados en este vaciado.",
        action: `Pedir a la planta una humedad (máx. cada ${db.plan.humidityMaxHours} h).` });
    } else if (ref) {
      const mins = minutesBetween(h.time, ref);
      if (mins != null && mins > db.plan.humidityMaxHours * 60) {
        out.push({ level: "act", icon: "🌡", title: "Humedad vencida",
          text: `Última humedad a las ${h.time} — hace ${fmt(mins / 60, 1)} h.`,
          action: `Solicitar nueva humedad (límite ${db.plan.humidityMaxHours} h).` });
      }
    }
  }

  // --- Racha en zona de acción ---
  const recent = rows.slice(-5).filter((t) => worstZone(t) === "act");
  if (recent.length >= 3)
    out.push({ level: "act", icon: "⚠", title: "Racha en zona de acción",
      text: `${recent.length} de las últimas 5 pruebas en zona de acción.`,
      action: "Ajuste de planta probablemente necesario." });

  return out;
}

/* Etiqueta de tendencia para las gráficas live (lo que Rubén realmente mira) */
function trendLabel(day, key) {
  const rows = testsOfDate(day).filter((t) => !t.rejected && num(t[key]) != null);
  if (rows.length < 4) return "";
  const v = rows.map((t) => num(t[key]));
  const d = (v.slice(-2).reduce((a, b) => a + b, 0) / 2) - (v.slice(-4, -2).reduce((a, b) => a + b, 0) / 2);
  const dp = key === "uw" ? 1 : 2;
  if (Math.abs(d) < (key === "uw" ? 0.3 : 0.15)) return "▬ estable";
  return (d > 0 ? "▲ subiendo " : "▼ bajando ") + fmt(Math.abs(d), dp) + (key === "uw" ? " pcf" : '"');
}

/* ------------------------------------------------------------ charts */
const CHART_DEFS = [
  { key: "slump", label: 'Slump (in)', get: (t) => num(t.slump), dp: 2 },
  { key: "air", label: "Aire (%)", get: (t) => num(t.air), dp: 1 },
  { key: "uw", label: "Peso Unitario (pcf)", get: (t) => num(t.uw), dp: 1 },
  { key: "temp", label: "Temperatura (°F)", get: (t) => num(t.temp), dp: 0 },
];
function bandsFor(key) {
  const p = db.plan;
  if (key === "slump") return { target: p.slump.target, actLo: p.slump.actLo, actHi: p.slump.actHi, suspLo: p.slump.suspLo, suspHi: p.slump.suspHi };
  if (key === "air") return { target: p.air.target, actLo: p.air.actLo, actHi: p.air.actHi, suspLo: p.air.suspLo, suspHi: p.air.suspHi };
  if (key === "uw") return { target: p.uw.target, actLo: p.uw.target - p.uw.act, actHi: p.uw.target + p.uw.act, suspLo: p.uw.target - p.uw.susp, suspHi: p.uw.target + p.uw.susp };
  if (key === "temp") return { target: null, actLo: null, actHi: p.tempMax - 3, suspLo: null, suspHi: p.tempMax };
  return {};
}

function svgChart({ pts, bands, dp, yUnit = "", pw = 13, h = 230 }) {
  if (!pts.length) return `<div class="empty">Sin datos.</div>`;
  const PW = pw, ML = 52, MR = 14, MT = 10, MB = 26, H = h;
  const W = ML + MR + Math.max(1, pts.length) * PW;
  const vals = pts.map((p) => p.v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (bands.suspLo != null) lo = Math.min(lo, bands.suspLo);
  if (bands.suspHi != null) hi = Math.max(hi, bands.suspHi);
  const pad = (hi - lo || 1) * 0.12;
  lo -= pad; hi += pad;
  const Y = (v) => MT + (hi - v) / (hi - lo) * (H - MT - MB);
  const X = (i) => ML + i * PW + PW / 2;

  let g = "";
  const y0 = MT, y1 = H - MB;
  g += `<rect x="${ML}" y="${y0}" width="${W - ML - MR}" height="${y1 - y0}" fill="var(--chart-susp, #fbe9e7)"/>`;
  if (bands.actLo != null || bands.actHi != null) {
    const t = bands.suspHi != null ? Y(bands.suspHi) : y0;
    const b = bands.suspLo != null ? Y(bands.suspLo) : y1;
    g += `<rect x="${ML}" y="${t}" width="${W - ML - MR}" height="${Math.max(0, b - t)}" fill="var(--chart-act, #fdf3d7)"/>`;
    const t2 = bands.actHi != null ? Y(bands.actHi) : y0;
    const b2 = bands.actLo != null ? Y(bands.actLo) : y1;
    g += `<rect x="${ML}" y="${t2}" width="${W - ML - MR}" height="${Math.max(0, b2 - t2)}" fill="var(--chart-ok, #e5f3e8)"/>`;
  }
  if (bands.target != null)
    g += `<line x1="${ML}" x2="${W - MR}" y1="${Y(bands.target)}" y2="${Y(bands.target)}" stroke="var(--chart-target, #16222e)" stroke-dasharray="6 4" stroke-width="1.4"/>`;
  const yticks = [bands.suspLo, bands.actLo, bands.target, bands.actHi, bands.suspHi].filter((v) => v != null);
  if (!yticks.length) yticks.push(lo + pad, hi - pad);
  for (const v of yticks)
    g += `<text x="${ML - 6}" y="${Y(v) + 3.5}" text-anchor="end" font-size="10" fill="var(--chart-text, #5a6b7c)">${fmt(v, dp)}</text>`;
  let lastDate = null;
  pts.forEach((p, i) => {
    if (p.date !== lastDate) {
      lastDate = p.date;
      g += `<line x1="${X(i) - PW / 2}" x2="${X(i) - PW / 2}" y1="${y0}" y2="${y1}" stroke="var(--chart-sep, #ffffff)" stroke-width="1.5"/>`;
      g += `<text x="${X(i)}" y="${H - 8}" font-size="9" fill="var(--chart-text, #5a6b7c)">${p.date.slice(5)}</text>`;
    }
  });
  g += `<polyline fill="none" stroke="#0f6db4" stroke-width="1.6" points="${pts.map((p, i) => X(i) + "," + Y(p.v)).join(" ")}"/>`;
  pts.forEach((p, i) => {
    const col = p.rejected ? "#c5221f" : p.z === "susp" ? "#c5221f" : p.z === "act" ? "#e8a013" : "#1e8e3e";
    const title = `<title>#${p.n} · ${p.date} · ticket ${p.ticket || "—"} · ${fmt(p.v, dp)}${yUnit}${p.rejected ? " · RECHAZADO" : ""}</title>`;
    if (p.rejected)
      g += `<g>${title}<path d="M${X(i) - 4},${Y(p.v) - 4} l8,8 M${X(i) + 4},${Y(p.v) - 4} l-8,8" stroke="${col}" stroke-width="2.4"/></g>`;
    else
      g += `<circle cx="${X(i)}" cy="${Y(p.v)}" r="3.4" fill="${col}" stroke="#fff" stroke-width="1">${title}</circle>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block">${g}</svg>`;
}

function chartFor(def, rangeN) {
  const tests = sortedTests().filter((t) => def.get(t) != null);
  const slice = rangeN === "all" ? tests : tests.slice(-rangeN);
  const zfn = def.key === "slump" ? zoneSlump : def.key === "air" ? zoneAir : def.key === "uw" ? zoneUW : zoneTemp;
  const pts = slice.map((t) => ({ n: t.n, date: t.date, ticket: t.ticket, v: def.get(t), z: zfn(t), rejected: t.rejected }));
  return svgChart({ pts, bands: bandsFor(def.key), dp: def.dp });
}
function chartForDay(def, day, pw = 30) {
  const tests = testsOfDate(day).filter((t) => def.get(t) != null);
  const zfn = def.key === "slump" ? zoneSlump : def.key === "air" ? zoneAir : def.key === "uw" ? zoneUW : zoneTemp;
  const pts = tests.map((t) => ({ n: t.n, date: t.date, ticket: t.ticket, v: def.get(t), z: zfn(t), rejected: t.rejected }));
  return svgChart({ pts, bands: bandsFor(def.key), dp: def.dp, pw });
}
function chartCS5(sets, rangeN) {
  const p = db.plan.cs;
  const withCS = sets.filter((s) => s.cs5 != null);
  const slice = rangeN === "all" ? withCS : withCS.slice(-rangeN);
  if (!slice.length) return `<div class="empty">Sin resultados de resistencia.</div>`;
  const pts = slice.map((s) => ({ n: s.n, date: s.date, ticket: s.ticket, v: s.cs5, z: zoneCS5(s.cs5), rejected: false, ma: s._ma5 }));
  const bands = { target: p.target, actLo: p.action, actHi: null, suspLo: p.openLow, suspHi: null };
  let svg = svgChart({ pts, bands, dp: 0, yUnit: " psi" });
  const PW = 13, ML = 52, MT = 10, MB = 26, H = 230;
  const vals = pts.map((q) => q.v);
  let lo = Math.min(...vals, p.openLow), hi = Math.max(...vals);
  const pad = (hi - lo || 1) * 0.12; lo -= pad; hi += pad;
  const Y = (v) => MT + (hi - v) / (hi - lo) * (H - MT - MB);
  const X = (i) => ML + i * PW + PW / 2;
  const maPts = pts.map((q, i) => (q.ma != null ? X(i) + "," + Y(q.ma) : null)).filter(Boolean);
  if (maPts.length > 1)
    svg = svg.replace("</svg>", `<polyline fill="none" stroke="var(--chart-ma, #122c42)" stroke-width="2.4" stroke-dasharray="2 3" points="${maPts.join(" ")}"/></svg>`);
  return svg;
}

/* ------------------------------------------------------------ CSV / files */
function csvCell(v) { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}
function exportCSV() {
  const headers = ["#", "Fecha", "Ticket", "Camion", "CY", "Planta", "Lote", "Identificacion", "Batch", "Llegada", "Comienza", "Muestra", "Termina", "Min", "Slump", "Aire", "UW", "UW objetivo", "Temp", "CS 1d", "CS 5d", "CS 28d", "MediaMovil5d", "Estado", "Comentarios"];
  const sets = strengthSets();
  const maOf = new Map(sets.map((s) => [s.n, s._ma5]));
  const rows = sortedTests().map((t) => [
    t.n, t.date, t.ticket, t.truck, t.vol, t.plant, t.lot, t.ident, t.batch, t.arrive, t.start, t.testTime, t.end,
    minutesBetween(t.batch, t.end) ?? "", t.slump, t.air, t.uw, t.uwTarget ?? db.plan.uw.target, t.temp,
    t.cs1, t.cs5, t.cs28, maOf.get(t.n) != null ? Math.round(maOf.get(t.n)) : "",
    t.rejected ? "RECHAZADO" : (worstZone(t) || "").toUpperCase(), t.comments,
  ]);
  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  downloadFile(`qc-pr52-pruebas-${todayISO()}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
  toast("CSV descargado");
}

/* ------------------------------------------------------------ rejection notice */
function notifyReject(n) {
  const t = db.tests.find((x) => x.n === n);
  if (!t) return;
  const meta = db.dayMeta[t.date] || {};
  const p = db.plan;
  const uwT = t.uwTarget ?? p.uw.target;
  const reasons = [];
  if (zoneSlump(t) === "susp") reasons.push(`Slump ${fmt(t.slump, 2)}" (susp. ${p.slump.suspLo}–${p.slump.suspHi}")`);
  if (zoneAir(t) === "susp") reasons.push(`Aire ${fmt(t.air, 1)}% (susp. ${p.air.suspLo}–${p.air.suspHi}%)`);
  if (zoneUW(t) === "susp") reasons.push(`UW ${fmt(t.uw, 2)} pcf (susp. ±${p.uw.susp} de ${uwT})`);
  if (zoneTemp(t) === "susp") reasons.push(`Temp ${fmt(t.temp, 0)} °F (máx ${p.tempMax})`);
  const subject = `RECHAZO DE CAMIÓN — Ticket ${t.ticket || "—"} — ${db.project.name}`;
  const body = [
    `AVISO DE RECHAZO DE HORMIGÓN`, ``,
    `Proyecto: ${db.project.name}`,
    `Mezcla: ${db.project.mixId}`,
    `Fecha: ${t.date}   Hora muestra: ${t.testTime || t.start || "—"}`,
    meta.fase || meta.lane ? `Fase: ${meta.fase || "—"}   Carril: ${meta.lane || "—"}   Cierre: ${meta.cierre || "—"}` : null,
    `Losa / Identificación: ${t.ident || "—"}`,
    `Ticket: ${t.ticket || "—"}   Camión: ${t.truck || "—"}   Volumen: ${fmt(t.vol, 1)} CY   Planta: ${t.plant || "—"}`, ``,
    `RESULTADOS:`,
    `  Slump: ${fmt(t.slump, 2)} in   (acción ${p.slump.actLo}–${p.slump.actHi} / susp ${p.slump.suspLo}–${p.slump.suspHi})`,
    `  UW: ${fmt(t.uw, 2)} pcf   (objetivo ${uwT} ±${p.uw.act} acción / ±${p.uw.susp} susp)`,
    `  Aire: ${fmt(t.air, 1)} %   (acción ${p.air.actLo}–${p.air.actHi} / susp ${p.air.suspLo}–${p.air.suspHi})`,
    `  Temp: ${fmt(t.temp, 0)} °F   (máx ${p.tempMax})`, ``,
    `MOTIVO: ${reasons.length ? reasons.join("; ") : (t.comments || "Rechazo manual — ver comentarios")}`,
    t.comments ? `Comentarios: ${t.comments}` : null, ``,
    `Generado por QC — Control de Hormigón PR-52`,
  ].filter((x) => x != null).join("\n");
  const to = db.project.notifyEmails || "";
  location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ------------------------------------------------------------ modal form builder */
function openForm({ title, fields, initial = {}, onSave, onDelete = null, submitLabel = "Guardar", liveEval = null }) {
  const root = document.getElementById("modal-root");
  const fid = "f-" + uid();
  root.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) closeForm()">
      <div class="modal">
        <div class="modal-head">${esc(title)}<div class="spacer"></div><button class="btn small" onclick="closeForm()">✕</button></div>
        <div class="modal-body"><form id="${fid}" onsubmit="return false"><div class="form-grid">
          ${fields.map((f) => {
            if (f.type === "label") return `<div class="fieldset-label">${esc(f.label)}</div>`;
            const val = initial[f.key] ?? f.default ?? "";
            let ctrl;
            if (f.type === "select")
              ctrl = `<select name="${f.key}">${(f.options || []).map((o) => `<option value="${esc(o.value)}" ${String(val) === String(o.value) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
            else if (f.type === "textarea")
              ctrl = `<textarea name="${f.key}" rows="2">${esc(val)}</textarea>`;
            else if (f.type === "checkbox")
              ctrl = `<select name="${f.key}"><option value="" ${!val ? "selected" : ""}>No</option><option value="1" ${val ? "selected" : ""}>Sí</option></select>`;
            else
              ctrl = `<input name="${f.key}" type="${f.type || "text"}" value="${esc(val)}" ${f.step != null ? `step="${f.step}"` : ""} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""} ${f.required ? "required" : ""}>`;
            return `<div class="field ${f.full ? "full" : ""} ${f.half ? "half" : ""}"><label>${esc(f.label)}${f.required ? " *" : ""}</label>${ctrl}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ""}</div>`;
          }).join("")}
        </div></form></div>
        ${liveEval ? `<div id="${fid}-live" style="padding:10px 20px; border-top:1px solid var(--line)"></div>` : ""}
        <div class="modal-foot">
          ${onDelete ? `<button class="btn danger" id="${fid}-del">Eliminar</button><div style="flex:1"></div>` : ""}
          <button class="btn" onclick="closeForm()">Cancelar</button>
          <button class="btn primary" id="${fid}-save">${esc(submitLabel)}</button>
        </div>
      </div>
    </div>`;
  document.getElementById(fid + "-save").onclick = () => {
    const form = document.getElementById(fid);
    const values = {}; let ok = true;
    for (const f of fields) {
      if (f.type === "label") continue;
      const el = form.elements[f.key];
      const v = el.value.trim();
      el.closest(".field").classList.remove("invalid");
      if (f.required && !v) { el.closest(".field").classList.add("invalid"); ok = false; continue; }
      if (f.type === "number") values[f.key] = v === "" ? null : Number(v);
      else if (f.type === "checkbox") values[f.key] = v === "1";
      else values[f.key] = v;
    }
    if (!ok) { toast("Complete los campos requeridos"); return; }
    onSave(values); closeForm();
  };
  if (onDelete) document.getElementById(fid + "-del").onclick = () => { onDelete(); closeForm(); };
  if (liveEval) {
    const form = document.getElementById(fid);
    const liveEl = document.getElementById(fid + "-live");
    const run = () => {
      const values = {};
      for (const f of fields) {
        if (f.type === "label") continue;
        const el = form.elements[f.key];
        if (!el) continue;
        const v = el.value.trim();
        if (f.type === "number") values[f.key] = v === "" ? null : Number(v);
        else if (f.type === "checkbox") values[f.key] = v === "1";
        else values[f.key] = v;
      }
      liveEl.innerHTML = liveEval(values);
    };
    form.addEventListener("input", run);
    form.addEventListener("change", run);
    run();
  }
  const first = root.querySelector("input, select, textarea");
  if (first) first.focus();
}
function closeForm() { const r = document.getElementById("modal-root"); if (r) r.innerHTML = ""; }

/* ------------------------------------------------------------ truck test form (shared) */
function formTest(_ignored, n, opts = {}) {
  const existing = n != null ? db.tests.find((t) => t.n === n) : null;
  const init = existing || {
    date: (typeof state !== "undefined" && state.day) ? state.day : todayISO(),
    vol: 10, plant: "01-SAN JUAN",
    ...(opts.prefill || {}),
  };
  const uwT = existing && existing.uwTarget != null ? existing.uwTarget : db.plan.uw.target;
  openForm({
    title: existing ? `Editar prueba #${existing.n}` : `Nueva prueba / camión (#${nextTestN()})`,
    initial: init,
    liveEval: (v) => {
      const pseudo = { slump: v.slump, air: v.air, uw: v.uw, temp: v.temp, uwTarget: uwT };
      const parts = [
        { k: "Slump", val: v.slump, z: zoneSlump(pseudo), u: '"' },
        { k: "UW", val: v.uw, z: zoneUW(pseudo), u: " pcf" },
        { k: "Aire", val: v.air, z: zoneAir(pseudo), u: "%" },
        { k: "Temp", val: v.temp, z: zoneTemp(pseudo), u: " °F" },
      ];
      const chips = parts.map((p) => p.val == null
        ? `<span class="badge neutral">${p.k}: —</span>`
        : `<span class="badge ${p.z === "susp" ? "susp" : p.z === "act" ? "act" : "ok"}">${p.k}: ${fmt(p.val, 2)}${p.u}</span>`
      ).join(" ");
      const w = worstZone(pseudo);
      let verdict, cls;
      if (v.rejected) { verdict = "RECHAZADO (manual)"; cls = "susp"; }
      else if (w === "susp") { verdict = "✕ RECHAZAR — fuera de límites de suspensión"; cls = "susp"; }
      else if (w === "act") { verdict = "⚠ ACEPTAR — zona de acción, vigilar"; cls = "act"; }
      else if (w === "ok") { verdict = "✓ ACEPTAR CAMIÓN"; cls = "ok"; }
      else { verdict = "Ingrese resultados de las pruebas…"; cls = "neutral"; }
      return `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">${chips}
        <span class="badge ${cls}" style="margin-left:auto; font-size:14px; padding:7px 16px">${verdict}</span></div>`;
    },
    onDelete: existing ? () => {
      if (!confirm(`¿Eliminar prueba #${existing.n}?`)) return;
      db.tests = db.tests.filter((t) => t.n !== existing.n);
      saveDB(); render(); toast("Prueba eliminada");
    } : null,
    fields: [
      { type: "label", label: "Camión / entrega" },
      { key: "date", label: "Fecha", type: "date", required: true },
      { key: "ticket", label: "Ticket", required: true },
      { key: "truck", label: "Camión" },
      { key: "vol", label: "Volumen (CY)", type: "number", step: "0.5" },
      { key: "plant", label: "Planta" },
      { key: "lot", label: "Lote" },
      { key: "ident", label: "Losa / Identificación", full: true, placeholder: "p.ej. Phase 10 - Slab L3-0.943" },
      { type: "label", label: "Tiempos" },
      { key: "batch", label: "Batch", type: "time" },
      { key: "arrive", label: "Llegada", type: "time" },
      { key: "start", label: "Comienza vaciado", type: "time" },
      { key: "testTime", label: "Toma de muestra", type: "time" },
      { key: "end", label: "Termina vaciado", type: "time" },
      { type: "label", label: "Pruebas frescas" },
      { key: "slump", label: "Slump (in)", type: "number", step: "0.25" },
      { key: "uw", label: "Peso unitario (pcf)", type: "number", step: "0.01" },
      { key: "air", label: "Aire (%)", type: "number", step: "0.1" },
      { key: "temp", label: "Temp (°F)", type: "number", step: "1" },
      { key: "rejected", label: "¿Rechazado?", type: "checkbox" },
      { type: "label", label: "Resistencias (promedio del set, psi)" },
      { key: "cs1", label: "1 día", type: "number", step: "10" },
      { key: "cs5", label: "5 días", type: "number", step: "10" },
      { key: "cs28", label: "28 días", type: "number", step: "10" },
      { key: "comments", label: "Comentarios", type: "textarea", full: true },
    ],
    onSave: (v) => {
      if (existing) Object.assign(existing, v);
      else {
        v.n = nextTestN();
        v.id = uid();
        v.uwTarget = db.plan.uw.target;
        db.tests.push(v);
        if (typeof state !== "undefined") state.day = v.date;
      }
      saveDB(); render();
      toast(existing ? "Prueba actualizada" : "Prueba registrada");
      if (opts.after) opts.after(existing || v);
    },
  });
}
