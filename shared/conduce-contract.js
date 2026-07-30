/* ============================================================
   CONTRATO DEL CONDUCE — v1
   El único punto de contacto entre las dos herramientas:
     · e-Ticket (concretera)  — crea el conduce
     · QCheck   (Segarra QC)  — lo enriquece
   Son productos independientes, para clientes distintos.
   NO comparten código de producto: comparten SOLO este contrato.
   Cambiar este archivo es cambiar la integración: súbele la versión
   y avisa a ambos lados.
   ============================================================ */
"use strict";

const CONDUCE_CONTRACT_VERSION = 3;
/* v2 — añade la contabilidad del record y el arranque del almacén, que en v1
        quedaban sin dueño y cada lado resolvía por su cuenta.
   v3 — publicación de límites de especificación: QC los PUBLICA, la planta
        los LEE. Una sola fuente de verdad para un número de cumplimiento. */

/* ------------------------------------------------------------
   1. Identidad del conduce
   Los números de ticket se repiten entre plantas distintas.
   La compañía los desambigua. Esta es la llave primaria.
------------------------------------------------------------ */
function conduceKeyOf(company, ticket) {
  return (company || "—") + "·" + (ticket == null ? "?" : String(ticket));
}

/* ------------------------------------------------------------
   2. Campos de origen (los únicos que la planta puede llenar)
   Todo lo demás — pruebas, veredicto, cilindros, tiempos de obra —
   lo escribe QCheck sobre el mismo record.
------------------------------------------------------------ */
const CONDUCE_ORIGIN_FIELDS = [
  "ticket",    // número de conduce
  "company",   // compañía (parte de la llave)
  "plant",     // planta que cargó
  "truck",     // número de camión
  "vol",       // volumen en CY
  "mix",       // código de mezcla
  "batch",     // hora de cargado "HH:MM"
];

/* ------------------------------------------------------------
   2b. Contabilidad del record (v2)
   No son datos del conduce: son los campos que el almacén necesita
   para ordenar y numerar. Los escribe QUIEN CREA el record —
   e-Ticket si la concretera es cliente, QCheck si no lo es.
------------------------------------------------------------ */
const CONDUCE_BOOKKEEPING_FIELDS = ["n", "id", "date", "source"];
// source: "eticket" | "qr" | "ocr" | "foto" | "manual" | "excel"

/* Fábrica única del record: garantiza que ambos lados creen la misma forma. */
function newConduceRecord(origin, tests) {
  const list = Array.isArray(tests) ? tests : [];
  const n = list.length ? Math.max(...list.map((t) => Number(t.n) || 0)) + 1 : 1;
  const d = new Date();
  const rec = {
    n, id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
    date: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"),
    source: origin.source || "manual",
  };
  for (const f of CONDUCE_ORIGIN_FIELDS) if (origin[f] != null) rec[f] = origin[f];
  return rec;
}

/* ------------------------------------------------------------
   2c. Arranque del almacén (v2)
   Dueño del esquema: QCheck. Pero cualquiera de los dos productos
   puede llegar primero a un navegador virgen, así que el sobre
   mínimo lo crea ESTE contrato — nunca cada herramienta a su modo.
------------------------------------------------------------ */
function ensureConduceStore() {
  try {
    const raw = localStorage.getItem(CONDUCE_STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  const empty = { version: 2, contract: CONDUCE_CONTRACT_VERSION,
                  project: {}, plan: {}, tests: [], dayMeta: {}, humidity: [] };
  localStorage.setItem(CONDUCE_STORE_KEY, JSON.stringify(empty));
  return empty;
}

/* ------------------------------------------------------------
   2d. Límites de especificación (v3) — publicación en un solo sentido

   Los límites salen del diseño de mezcla aprobado del PROYECTO, no de la
   planta. Por eso **QCheck los publica y e-Ticket solo los lee**: si cada
   concretera entrara los suyos, la planta podría creerse dentro de rango
   mientras QC la rechaza — dos verdades para un mismo número de cumplimiento.

   Se publica únicamente lo que la planta puede corregir en caliente.
   La aceptación por resistencia NO se publica: es contractual, es de QC.
------------------------------------------------------------ */
function mixCodeOf(mixId) {
  if (!mixId) return null;
  return String(mixId).trim().split(/[\s\-–—(]/)[0].toUpperCase() || null;
}

/* Solo QCheck llama a esto. */
function publishMixSpec(store, mixId, plan) {
  const code = mixCodeOf(mixId);
  if (!code || !plan) return null;
  if (!store.specs) store.specs = {};
  store.specs[code] = {
    mix: code,
    slump: { target: plan.slump.target, actLo: plan.slump.actLo, actHi: plan.slump.actHi,
             suspLo: plan.slump.suspLo, suspHi: plan.slump.suspHi },
    air:   { target: plan.air.target, actLo: plan.air.actLo, actHi: plan.air.actHi,
             suspLo: plan.air.suspLo, suspHi: plan.air.suspHi },
    uw:    { target: plan.uw.target, act: plan.uw.act, susp: plan.uw.susp },
    tempMax: plan.tempMax,
    publishedBy: "qcheck",
    updated: new Date().toISOString().slice(0, 10),
  };
  return store.specs[code];
}

/* e-Ticket llama a esto. Devuelve null si QC todavía no ha publicado:
   en ese caso la planta muestra el número sin colorear, nunca inventa límites.

   Respaldo deliberado: si el record no declara mezcla — los históricos
   importados del Excel no la traen, solo el proyecto — y QC publicó UNA
   sola especificación, se usa esa. No hay ambigüedad posible. Con dos o
   más mezclas publicadas devuelve null, porque adivinar cuál aplica sí
   sería inventar. */
function readMixSpec(store, mixId) {
  if (!store || !store.specs) return null;
  const code = mixCodeOf(mixId);
  if (code && store.specs[code]) return store.specs[code];
  if (code) return null;                       // mezcla declarada pero sin publicar
  const all = Object.keys(store.specs);
  return all.length === 1 ? store.specs[all[0]] : null;
}

/* Zona de una lectura contra la especificación publicada:
   "ok" | "act" (entre acción y suspensión) | "susp" (fuera) | null (sin spec) */
function zoneAgainstSpec(spec, field, value) {
  if (spec == null || value == null) return null;
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  if (field === "temp") {
    if (spec.tempMax == null) return null;
    return v > spec.tempMax ? "susp" : v > spec.tempMax - 3 ? "act" : "ok";
  }
  if (field === "uw") {
    const t = spec.uw && spec.uw.target;
    if (t == null) return null;
    if (v < t - spec.uw.susp || v > t + spec.uw.susp) return "susp";
    if (v < t - spec.uw.act || v > t + spec.uw.act) return "act";
    return "ok";
  }
  const s = spec[field];
  if (!s) return null;
  if (v < s.suspLo || v > s.suspHi) return "susp";
  if (v < s.actLo || v > s.actHi) return "act";
  return "ok";
}

/* ------------------------------------------------------------
   3. Carga útil del QR
   El QR es una LLAVE, no una copia de los datos: los resultados
   todavía no existen cuando se imprime el ticket. Lleva el
   identificador + un resumen mínimo del origen para que QCheck
   opere sin señal y sincronice después.
------------------------------------------------------------ */
function encodeConduceQR(o) {
  return JSON.stringify({
    v: CONDUCE_CONTRACT_VERSION,
    k: conduceKeyOf(o.company, o.ticket),
    ticket: o.ticket, company: o.company, plant: o.plant,
    truck: o.truck, vol: o.vol, mix: o.mix, batch: o.batch,
  });
}

/* Acepta el JSON de arriba o el respaldo delimitado:
   ticket;camion;cy;horaBatch;compañía;planta                      */
function decodeConduceQR(raw) {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (d && d.ticket) return { ...d, _format: "json" };
  } catch (_) {}
  const p = String(raw).split(/[;|,]/).map((s) => s.trim());
  if (!p[0]) return null;
  return {
    v: CONDUCE_CONTRACT_VERSION,
    ticket: p[0], truck: p[1] || null,
    vol: p[2] ? Number(p[2]) : null,
    batch: /^\d{1,2}:\d{2}$/.test(p[3] || "") ? p[3].padStart(5, "0") : null,
    company: p[4] || null, plant: p[5] || null,
    _format: "delimitado",
  };
}

/* ------------------------------------------------------------
   4. Runtime compartido (SOLO prototipo)
   Hoy ambas herramientas leen y escriben la misma base local para
   que la demo funcione de punta a punta en una máquina.
   En producción son sistemas separados que hablan por API: cambia
   solo esta constante y la capa de transporte, nada más.
------------------------------------------------------------ */
const CONDUCE_STORE_KEY = "qc-pr52-db-v1";

if (typeof window !== "undefined") {
  window.ConduceContract = {
    VERSION: CONDUCE_CONTRACT_VERSION,
    keyOf: conduceKeyOf,
    ORIGIN_FIELDS: CONDUCE_ORIGIN_FIELDS,
    BOOKKEEPING_FIELDS: CONDUCE_BOOKKEEPING_FIELDS,
    newRecord: newConduceRecord,
    ensureStore: ensureConduceStore,
    mixCodeOf, publishMixSpec, readMixSpec, zoneAgainstSpec,
    encodeQR: encodeConduceQR,
    decodeQR: decodeConduceQR,
    STORE_KEY: CONDUCE_STORE_KEY,
  };
}
