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

const CONDUCE_CONTRACT_VERSION = 1;

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
    encodeQR: encodeConduceQR,
    decodeQR: decodeConduceQR,
    STORE_KEY: CONDUCE_STORE_KEY,
  };
}
