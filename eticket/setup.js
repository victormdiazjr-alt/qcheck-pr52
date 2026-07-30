/* ============================================================
   e-Ticket — setup inicial y ajustes.
   Aparece solo cuando la herramienta no está configurada, y se
   puede volver a abrir cuando se quiera desde Despacho.
   ============================================================ */
"use strict";

const THEME_KEY = "eticket-theme";
const $ = (id) => document.getElementById(id);
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function toast(msg, bad) {
  const el = $("toast");
  el.textContent = msg; el.classList.toggle("bad", !!bad); el.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

const ICON_SUN = `<svg viewBox="0 0 24 24" style="width:56%;height:56%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.3"/><path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5"/></svg>`;
const ICON_MOON = `<svg viewBox="0 0 24 24" style="width:54%;height:54%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 14.5A8.6 8.6 0 0 1 9.5 3.8a8.6 8.6 0 1 0 10.7 10.7z"/></svg>`;
function stApplyTheme(t) {
  document.documentElement.dataset.theme = t;
  const b = $("theme-toggle");
  if (b) { b.innerHTML = t === "dark" ? ICON_SUN : ICON_MOON; b.title = t === "dark" ? "Modo claro" : "Modo oscuro"; }
}
function stToggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next); stApplyTheme(next);
}

/* ------------------------------------------------------------ estado en edición */
let draft = { company: "", plants: [], mixes: [], nextTicket: "", paper: "auto" };
let isFirstRun = false;

/* ---------- plantas ---------- */
function stRenderPlants() {
  $("plants").innerHTML = draft.plants.map((p, i) => `
    <div class="rowedit">
      <input class="rin" value="${esc(p.name)}" placeholder="ej. 01-SAN JUAN"
             oninput="draft.plants[${i}].name = this.value">
      <button class="pick ${p.default ? "on" : ""}" onclick="stDefaultPlant(${i})"
              title="Marcar como predeterminada">${p.default ? "Predeterminada" : "Hacer predeterminada"}</button>
      <button class="del" onclick="stDelPlant(${i})" title="Eliminar" aria-label="Eliminar planta">✕</button>
    </div>`).join("");
}
function stAddPlant() { draft.plants.push({ name: "", default: !draft.plants.length }); stRenderPlants(); }
function stDelPlant(i) {
  const wasDefault = draft.plants[i].default;
  draft.plants.splice(i, 1);
  if (wasDefault && draft.plants.length) draft.plants[0].default = true;
  stRenderPlants();
}
function stDefaultPlant(i) { draft.plants.forEach((p, k) => (p.default = k === i)); stRenderPlants(); }

/* ---------- mezclas ---------- */
function stRenderMixes() {
  $("mixes").innerHTML = draft.mixes.map((m, i) => `
    <div class="rowedit">
      <input class="rin" value="${esc(m.code)}" placeholder="código — ej. AC300503SX"
             oninput="draft.mixes[${i}].code = this.value">
      <input class="rin desc" value="${esc(m.desc || "")}" placeholder="descripción (opcional)"
             oninput="draft.mixes[${i}].desc = this.value">
      <button class="pick ${m.default ? "on" : ""}" onclick="stDefaultMix(${i})"
              title="Marcar como predeterminada">${m.default ? "Predeterminada" : "Hacer predeterminada"}</button>
      <button class="del" onclick="stDelMix(${i})" title="Eliminar" aria-label="Eliminar mezcla">✕</button>
    </div>`).join("");
}
function stAddMix() { draft.mixes.push({ code: "", desc: "", default: !draft.mixes.length }); stRenderMixes(); }
function stDelMix(i) {
  const wasDefault = draft.mixes[i].default;
  draft.mixes.splice(i, 1);
  if (wasDefault && draft.mixes.length) draft.mixes[0].default = true;
  stRenderMixes();
}
function stDefaultMix(i) { draft.mixes.forEach((m, k) => (m.default = k === i)); stRenderMixes(); }

/* ---------- papel ---------- */
function stRenderPapers() {
  $("papers").innerHTML = ET_PAPERS.map((p) => `
    <button class="paper ${draft.paper === p.id ? "on" : ""}" onclick="stPickPaper('${p.id}')">
      <span class="pl">${esc(p.label)}</span>
      <span class="pd">${esc(p.desc)}</span>
    </button>`).join("");
}
function stPickPaper(id) { draft.paper = id; stRenderPapers(); }

/* ------------------------------------------------------------ guardar */
function stSave() {
  const company = $("s-company").value.trim();
  const plants = draft.plants.map((p) => ({ ...p, name: p.name.trim() })).filter((p) => p.name);
  const mixes = draft.mixes.map((m) => ({ ...m, code: m.code.trim(), desc: (m.desc || "").trim() })).filter((m) => m.code);
  const next = Number($("s-next").value.trim());

  if (!company) { toast("Falta el nombre de la compañía", true); $("s-company").focus(); return; }
  if (!plants.length) { toast("Añada por lo menos una planta", true); return; }
  if (!mixes.length) { toast("Añada por lo menos una mezcla", true); return; }
  if (!Number.isFinite(next) || next < 1) { toast("El próximo conduce debe ser un número", true); $("s-next").focus(); return; }
  if (!plants.some((p) => p.default)) plants[0].default = true;
  if (!mixes.some((m) => m.default)) mixes[0].default = true;

  etConfigWrite({ version: 1, company, plants, mixes, nextTicket: Math.floor(next), paper: draft.paper });
  toast("Configuración guardada");
  setTimeout(() => location.href = "index.html", 500);
}
function stCancel() { location.href = etConfigured() ? "index.html" : "setup.html?first=1"; }

/* ------------------------------------------------------------ arranque */
function stInit() {
  stApplyTheme(localStorage.getItem(THEME_KEY) || "dark");
  const cfg = etConfigRead();
  isFirstRun = !cfg || new URLSearchParams(location.search).has("first");

  if (cfg) {
    draft = {
      company: cfg.company,
      plants: cfg.plants.map((p) => ({ ...p })),
      mixes: (cfg.mixes || []).map((m) => ({ ...m })),
      nextTicket: cfg.nextTicket,
      paper: cfg.paper || "auto",
    };
  } else {
    draft = { company: "", plants: [{ name: "", default: true }], mixes: [{ code: "", desc: "", default: true }], nextTicket: "", paper: "auto" };
  }

  $("s-company").value = draft.company;
  $("s-next").value = draft.nextTicket;
  $("intro").innerHTML = cfg
    ? "Ajustes de la herramienta. Los cambios aplican al próximo ticket que genere."
    : "Antes de despachar el primer camión hay que decirle a e-Ticket <b>quién es usted y qué produce</b>. Toma un minuto y se puede cambiar después.";
  $("btn-cancel").hidden = !cfg;
  $("hsub").textContent = cfg ? cfg.company : "Primera vez";

  stRenderPlants(); stRenderMixes(); stRenderPapers();
}
document.addEventListener("DOMContentLoaded", stInit);
