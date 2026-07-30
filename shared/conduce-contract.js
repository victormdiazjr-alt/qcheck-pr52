/* ============================================================
   CONTRATO DEL CONDUCE — capa de INTEROPERABILIDAD (opcional)

   e-Ticket (concretera) y QCheck (Segarra QC) son **productos
   independientes**. Ninguno necesita al otro para funcionar:

     · e-Ticket vende solo. Su cliente puede no tener nada que ver
       con Segarra: venta residencial, obra privada, otro inspector.
     · QCheck opera solo. La mayoría de las concreteras que inspecciona
       NO tendrán e-Ticket ni códigos QR: llegan con conduce en papel.

   Este archivo NO es una dependencia: es el idioma común PARA CUANDO
   ambos coinciden en la misma obra. Si falta, cada herramienta sigue
   funcionando completa — solo se pierde el traspaso automático.

   Regla: ninguna herramienta puede requerir este archivo para arrancar.
   ============================================================ */
"use strict";

const CONDUCE_CONTRACT_VERSION = 4;
/* v2 — contabilidad del record y arranque del almacén.
   v3 — límites de especificación: QC los PUBLICA, la planta los LEE.
   v4 — INDEPENDENCIA: cada herramienta tiene su propio almacén; el QR pasa a
        ser una URL pública que sirve a los dos usos (cliente residencial que
        paga desde su teléfono, y QCheck que importa el conduce sin señal). */

/* Cada producto es dueño de su propia base. El contrato NO impone una común. */
const ETICKET_STORE_KEY = "eticket-db-v1";   // conduces de la concretera
const QCHECK_STORE_KEY  = "qc-pr52-db-v1";   // pruebas y control de QC

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
function ensureConduceStore(storeKey) {
  const key = storeKey || CONDUCE_STORE_KEY;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  const empty = { version: 2, contract: CONDUCE_CONTRACT_VERSION,
                  project: {}, plan: {}, tests: [], dayMeta: {}, humidity: [] };
  localStorage.setItem(key, JSON.stringify(empty));
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
/* Un QR, dos públicos:

   · El CLIENTE RESIDENCIAL apunta la cámara del teléfono, se le abre la
     página del conduce y paga su factura ahí mismo. Por eso es una URL.
   · QCheck lee esa misma URL y saca los datos del fragmento (#), sin
     conexión y sin abrir nada. Por eso el fragmento carga el resumen.

   El fragmento nunca viaja al servidor: los datos del conduce no quedan
   en registros de acceso ni en el historial del proveedor.               */
function encodeConduceQR(o, baseUrl) {
  const q = new URLSearchParams({
    v: String(CONDUCE_CONTRACT_VERSION),
    k: conduceKeyOf(o.company, o.ticket),
    tk: o.ticket == null ? "" : String(o.ticket),
    co: o.company || "", pl: o.plant || "", tr: o.truck || "",
    cy: o.vol == null ? "" : String(o.vol), mx: o.mix || "", bt: o.batch || "",
  });
  const base = (baseUrl || "").replace(/[#?].*$/, "").replace(/\/$/, "");
  return base ? `${base}/#${q}` : `#${q}`;   // sin URL configurada: solo el fragmento
}

/* Acepta la URL de arriba, el JSON de v1–v3, o el respaldo delimitado
   `ticket;camion;cy;horaBatch;compañía;planta` (conduces de otros sistemas). */
function decodeConduceQR(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // 1) URL o fragmento suelto — formato v4
  const hash = s.indexOf("#");
  if (hash !== -1) {
    const q = new URLSearchParams(s.slice(hash + 1));
    if (q.get("tk")) return {
      v: Number(q.get("v")) || CONDUCE_CONTRACT_VERSION,
      ticket: q.get("tk"), company: q.get("co") || null, plant: q.get("pl") || null,
      truck: q.get("tr") || null, vol: q.get("cy") ? Number(q.get("cy")) : null,
      mix: q.get("mx") || null, batch: q.get("bt") || null,
      url: hash > 0 ? s : null, _format: "url",
    };
  }

  // 2) JSON — contratos v1 a v3
  try {
    const d = JSON.parse(s);
    if (d && d.ticket) return { ...d, _format: "json" };
  } catch (_) {}

  // 3) Delimitado — conduces de sistemas ajenos
  const p = s.split(/[;|,]/).map((x) => x.trim());
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
    STORE_KEY: CONDUCE_STORE_KEY,          // heredado (compatibilidad)
    ETICKET_STORE_KEY, QCHECK_STORE_KEY,
  };
}
