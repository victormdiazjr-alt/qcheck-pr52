/* ============================================================
   e-Ticket — respaldo mínimo del contrato del conduce.

   e-Ticket es un producto que se vende SOLO. Su cliente puede no
   tener nada que ver con Segarra: venta residencial, obra privada,
   otro inspector. Por eso la herramienta NO puede depender de
   ../shared/conduce-contract.js para arrancar.

   Este archivo define lo mínimo que e-Ticket necesita **solo si el
   contrato no está cargado**. Si el contrato existe, manda él y esto
   no hace nada. La duplicación es deliberada: es el precio de que la
   herramienta funcione sola.

   Lo único que se pierde sin el contrato es el traspaso a QCheck.
   ============================================================ */
(function () {
  "use strict";
  if (typeof window === "undefined" || window.ConduceContract) return;

  const VERSION = 4;
  const ETICKET_STORE_KEY = "eticket-db-v1";

  const keyOf = (company, ticket) =>
    (company || "—") + "·" + (ticket == null ? "?" : String(ticket));

  const ORIGIN_FIELDS = ["ticket", "company", "plant", "truck", "vol", "mix", "batch"];

  function newRecord(origin, tests) {
    const list = Array.isArray(tests) ? tests : [];
    const n = list.length ? Math.max(...list.map((t) => Number(t.n) || 0)) + 1 : 1;
    const d = new Date();
    const rec = {
      n, id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
      date: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"),
      source: origin.source || "manual",
    };
    for (const f of ORIGIN_FIELDS) if (origin[f] != null) rec[f] = origin[f];
    return rec;
  }

  function ensureStore(storeKey) {
    const key = storeKey || ETICKET_STORE_KEY;
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    const empty = { version: 2, contract: VERSION, tests: [] };
    localStorage.setItem(key, JSON.stringify(empty));
    return empty;
  }

  /* Misma URL que produce el contrato: un QR, dos públicos. */
  function encodeQR(o, baseUrl) {
    const q = new URLSearchParams({
      v: String(VERSION), k: keyOf(o.company, o.ticket),
      tk: o.ticket == null ? "" : String(o.ticket),
      co: o.company || "", pl: o.plant || "", tr: o.truck || "",
      cy: o.vol == null ? "" : String(o.vol), mx: o.mix || "", bt: o.batch || "",
    });
    const base = (baseUrl || "").replace(/[#?].*$/, "").replace(/\/$/, "");
    return base ? `${base}/#${q}` : `#${q}`;
  }

  function decodeQR(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    const hash = s.indexOf("#");
    if (hash !== -1) {
      const q = new URLSearchParams(s.slice(hash + 1));
      if (q.get("tk")) return {
        v: Number(q.get("v")) || VERSION,
        ticket: q.get("tk"), company: q.get("co") || null, plant: q.get("pl") || null,
        truck: q.get("tr") || null, vol: q.get("cy") ? Number(q.get("cy")) : null,
        mix: q.get("mx") || null, batch: q.get("bt") || null,
        url: hash > 0 ? s : null, _format: "url",
      };
    }
    try { const d = JSON.parse(s); if (d && d.ticket) return { ...d, _format: "json" }; } catch (_) {}
    return null;
  }

  /* Sin contrato no hay especificación publicada: nunca se inventa una. */
  const readMixSpec = () => null;
  const zoneAgainstSpec = () => null;
  const mixCodeOf = (m) => (m ? String(m).trim().split(/[\s\-–—(]/)[0].toUpperCase() || null : null);

  window.ConduceContract = {
    VERSION, standalone: true,
    keyOf, ORIGIN_FIELDS, newRecord, ensureStore,
    encodeQR, decodeQR, readMixSpec, zoneAgainstSpec, mixCodeOf,
    ETICKET_STORE_KEY, QCHECK_STORE_KEY: "qc-pr52-db-v1",
  };
})();
