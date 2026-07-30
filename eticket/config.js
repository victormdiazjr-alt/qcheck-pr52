/* ============================================================
   e-Ticket — configuración de la herramienta.

   Es del PRODUCTO, no del conduce: no entra en el record ni en el
   contrato. Clave propia en localStorage.

   Nada aquí se infiere del histórico y nada viene quemado en el
   código: el catálogo lo entra la concretera en el setup inicial
   (setup.html) y se puede editar después.
   ============================================================ */
"use strict";

const ET_CONFIG_KEY = "eticket-config-v1";

const ET_PAPERS = [
  { id: "auto", label: "Automático", desc: "usa el tamaño que traiga la impresora" },
  { id: "58", label: "Rollo 58 mm", desc: "impresora térmica estrecha" },
  { id: "80", label: "Rollo 80 mm", desc: "impresora térmica de caseta" },
  { id: "letter", label: "Letter / A4", desc: "hoja normal, ticket arriba para cortar" },
];

function etConfigRead() {
  try {
    const raw = localStorage.getItem(ET_CONFIG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !c.company || !Array.isArray(c.plants) || !c.plants.length) return null;
    return c;
  } catch (_) { return null; }
}
function etConfigWrite(c) { localStorage.setItem(ET_CONFIG_KEY, JSON.stringify(c)); }
function etConfigured() { return etConfigRead() != null; }

/* ------------------------------------------------------------ facturación
   Tarifas de la planta. Viajan dentro del QR (en el fragmento) porque el
   teléfono del cliente nunca ha visto esta configuración: la página pública
   vive solo de lo que trae la URL. */
function etBilling(c) {
  const b = (c && c.billing) || {};
  return {
    price: Number(b.price) || 0,      // $ por CY
    tripFee: Number(b.tripFee) || 0,  // $ por viaje
    taxPct: Number(b.taxPct) || 0,    // % de impuesto
  };
}
function etBillingReady(c) { return etBilling(c).price > 0; }

/* Calcula la factura. Misma fórmula que usa la página del cliente. */
function etInvoice({ vol, price, tripFee, extra, taxPct }) {
  const cy = Number(vol) || 0;
  const material = cy * (Number(price) || 0);
  const viaje = Number(tripFee) || 0;
  const otros = Number(extra) || 0;
  const subtotal = material + viaje + otros;
  const tax = subtotal * ((Number(taxPct) || 0) / 100);
  return { cy, material, viaje, otros, subtotal, tax, total: subtotal + tax };
}

function etDefaultPlant(c) {
  const d = c.plants.find((p) => p.default);
  return (d || c.plants[0]).name;
}
function etDefaultMix(c) {
  const d = (c.mixes || []).find((m) => m.default);
  return d ? d.code : ((c.mixes || [])[0] || {}).code || "";
}

/* Si no está configurada, no se despacha: al setup. */
function etRequireConfig() {
  if (etConfigured()) return etConfigRead();
  location.replace("setup.html?first=1");
  return null;
}

/* ------------------------------------------------------------ papel
   El navegador NO puede enumerar ni elegir impresoras — eso lo hace el
   diálogo nativo del sistema. Aquí solo se ajusta la MAQUETA para que
   la hojita salga bien en el papel que el usuario vaya a usar. */
const ET_PAGE_RULES = {
  auto: "@page { margin: 6mm; }",
  "58": "@page { size: 58mm auto; margin: 3mm; }",
  "80": "@page { size: 80mm auto; margin: 4mm; }",
  letter: "@page { size: Letter portrait; margin: 14mm; }",
};
function etApplyPaper(paper) {
  const p = ET_PAGE_RULES[paper] ? paper : "auto";
  document.documentElement.dataset.paper = p;
  let st = document.getElementById("page-rule");
  if (!st) { st = document.createElement("style"); st.id = "page-rule"; document.head.appendChild(st); }
  st.textContent = ET_PAGE_RULES[p];
}
