/* ============================================================
   e-Ticket — CAPA DE DATOS. Único punto del producto que toca el
   almacenamiento.

   e-Ticket tendrá su propio backend y su propio dominio: no comparte
   servidor ni base con ningún otro producto. Hoy los conduces viven en
   localStorage bajo la clave propia de e-Ticket; mañana vivirán detrás
   de su API.

   Cuando llegue ese backend se reescriben SOLO estas funciones
   (a `fetch`, probablemente asíncronas) y ninguna pantalla se entera.
   Ninguna otra parte de e-Ticket puede leer o escribir almacenamiento
   directamente.
   ============================================================ */
"use strict";

const EtDatos = (function () {
  const C = window.ConduceContract;
  const KEY = (C && C.ETICKET_STORE_KEY) || "eticket-db-v1";

  function leer() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); if (s && Array.isArray(s.tests)) return s; }
    } catch (e) { console.error("e-Ticket: base local ilegible", e); }
    return null;
  }
  function guardar(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  return {
    STORE_KEY: KEY,

    /* ¿ya existe la base en este dispositivo? */
    existe() { return leer() != null; },

    /* Todos los conduces de la concretera. */
    conduces() { const s = leer(); return s ? s.tests : []; },

    /* Conduces de una compañía (la planta solo ve lo suyo). */
    conducesDe(company) {
      return this.conduces().filter((t) => (t.company || "—") === company);
    },

    /* Crea el conduce con los datos de origen y lo devuelve. */
    crear(origen) {
      const s = C.ensureStore(KEY);
      if (!Array.isArray(s.tests)) s.tests = [];
      const rec = C.newRecord({ ...origen, source: "eticket" }, s.tests);
      if (origen.extra != null) rec.extra = origen.extra;
      if (origen.extraLabel) rec.extraLabel = origen.extraLabel;
      s.tests.push(rec);
      guardar(s);
      return rec;
    },

    /* ¿existe ya ese conduce? (llave = compañía + número) */
    existeConduce(company, ticket) {
      const k = C.keyOf(company, ticket);
      return this.conduces().some((t) => C.keyOf(t.company, t.ticket) === k);
    },

    buscarPorLlave(key) {
      return this.conduces().find((t) => C.keyOf(t.company, t.ticket) === key) || null;
    },

    /* Especificaciones publicadas por un laboratorio, si las hubiera
       recibido esta base por integración. Sin integración: null. */
    specDe(mixId) { const s = leer(); return s ? C.readMixSpec(s, mixId) : null; },

    /* Para sincronización en vivo entre ventanas de la misma herramienta. */
    esNuestraClave(k) { return k === KEY; },
  };
})();
