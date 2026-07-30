/* ============================================================
   QC — Control Center (full version)
   Requires: seed.js + core.js loaded first.
   Role screens: portal.html · display.html · conduce.html ·
   produccion.html · autoridad.html — all share the same DB.
   ============================================================ */
"use strict";

/* ------------------------------------------------------------ UI state */
const state = { tab: "dashboard", day: null, search: "", showAll: false, chartRange: 80 };

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll("#main-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  render();
}
function render() {
  const app = document.getElementById("app");
  if (state.tab === "dashboard") app.innerHTML = viewDashboard();
  else if (state.tab === "live") app.innerHTML = viewLive();
  else if (state.tab === "daily") app.innerHTML = viewDaily();
  else if (state.tab === "tests") app.innerHTML = viewTests();
  else if (state.tab === "strength") app.innerHTML = viewStrength();
  else if (state.tab === "charts") app.innerHTML = viewCharts();
  else if (state.tab === "plan") app.innerHTML = viewPlan();
}

/* ------------------------------------------------------------ Dashboard */
function viewDashboard() {
  const tests = sortedTests();
  const totalCY = tests.reduce((a, t) => a + (num(t.vol) || 0), 0);
  const days = testDates();
  const rejected = tests.filter((t) => t.rejected).length;
  const sets = strengthSets();
  const lastMA = [...sets].reverse().find((s) => s._ma5 != null);
  const last30 = tests.slice(-30);
  const okCount = last30.filter((t) => !t.rejected && worstZone(t) === "ok").length;

  const lastDay = days[0];
  const lastDayTests = lastDay ? testsOfDate(lastDay) : [];
  const alerts = [];
  if (lastMA && lastMA._ma5 < db.plan.cs.target)
    alerts.push({ level: "susp", text: `Media móvil (${db.plan.maWindow}) de 5 días = ${fmt(lastMA._ma5, 0)} psi — POR DEBAJO del objetivo ${fmt(db.plan.cs.target, 0)} psi.` });
  const recentSusp = tests.slice(-15).filter((t) => !t.rejected && worstZone(t) === "susp");
  if (recentSusp.length)
    alerts.push({ level: "susp", text: `${recentSusp.length} prueba(s) reciente(s) fuera de límite de suspensión sin marcar como rechazadas — revisar.` });
  const recentAct = tests.slice(-15).filter((t) => worstZone(t) === "act");
  if (recentAct.length >= 4)
    alerts.push({ level: "act", text: `${recentAct.length} pruebas recientes en zona de acción — vigilar tendencia (ajuste de planta puede ser necesario).` });

  return `
    <div class="grid cols-6">
      <div class="stat"><div class="label">Pruebas</div><div class="value">${tests.length}</div><div class="sub">${days.length} días de vaciado</div></div>
      <div class="stat"><div class="label">Hormigón</div><div class="value">${fmt(totalCY, 0)}</div><div class="sub">yardas cúbicas</div></div>
      <div class="stat ${rejected ? "alert" : ""}"><div class="label">Rechazados</div><div class="value">${rejected}</div><div class="sub">camiones</div></div>
      <div class="stat"><div class="label">Sets resistencia</div><div class="value">${sets.length}</div><div class="sub">${sets.filter((s) => s.cs5 != null).length} con 5 días</div></div>
      <div class="stat ${lastMA ? (lastMA._ma5 >= db.plan.cs.target ? "good" : "alert") : ""}"><div class="label">Media móvil 5d</div>
        <div class="value">${lastMA ? fmt(lastMA._ma5, 0) : "—"}</div><div class="sub">objetivo ${fmt(db.plan.cs.target, 0)} psi</div></div>
      <div class="stat ${okCount / (last30.length || 1) >= 0.8 ? "good" : ""}"><div class="label">Zona OK</div>
        <div class="value">${last30.length ? Math.round(okCount / last30.length * 100) + "%" : "—"}</div><div class="sub">últimas ${last30.length} pruebas</div></div>
    </div>

    ${alerts.map((a) => `<div class="notice ${a.level}" style="margin-top:14px">⚠ ${esc(a.text)}</div>`).join("")}

    <div class="grid cols-2" style="margin-top:16px">
      <div class="panel">
        <div class="panel-head"><h2>Último vaciado — ${lastDay ? fmtDate(lastDay) : "—"}</h2><div class="spacer"></div>
          <button class="btn small" onclick="state.day='${lastDay}'; switchTab('daily')">Abrir hoja</button></div>
        <div class="panel-body flush">
          ${lastDayTests.length ? `<div class="table-wrap"><table class="data">
            <tr><th>#</th><th>Losa / Ident.</th><th>Camión</th><th class="num">Slump</th><th class="num">UW</th><th class="num">Temp</th><th>Estado</th></tr>
            ${lastDayTests.slice(-8).map((t) => `<tr class="clickable ${t.rejected ? "rejected" : ""}" onclick="formTest(null,${t.n})">
              <td class="mono">${t.n}</td><td style="white-space:normal">${esc(shortIdent(t.ident))}</td><td class="mono">${esc(t.truck || "—")}</td>
              <td${zClass(zoneSlump(t))}>${fmt(t.slump, 2)}</td>
              <td${zClass(zoneUW(t))}>${fmt(t.uw, 2)}</td>
              <td${zClass(zoneTemp(t))}>${fmt(t.temp, 0)}</td>
              <td>${estadoBadge(t)}</td></tr>`).join("")}
          </table></div>` : `<div class="empty">Sin pruebas.</div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Resistencia 5 días — últimas ${Math.min(10, sets.filter((s) => s.cs5 != null).length)}</h2><div class="spacer"></div>
          <button class="btn small" onclick="switchTab('strength')">Ver todas</button></div>
        <div class="panel-body flush">
          ${sets.filter((s) => s.cs5 != null).slice(-10).reverse().map((s) => {
            const z = zoneCS5(s.cs5);
            return `<div style="display:flex; align-items:center; gap:10px; padding:7px 16px; border-bottom:1px solid var(--line); font-size:13px">
              <span class="mono muted" style="width:78px">${fmtDate(s.date)}</span>
              <span class="mono" style="width:60px">#${esc(s.ticket)}</span>
              <b class="mono" style="width:70px; text-align:right; color:${z === "ok" ? "var(--ok)" : z === "act" ? "var(--act)" : "var(--susp)"}">${fmt(s.cs5, 0)}</b>
              <span class="muted">psi</span>
              ${s._ma5 != null ? `<span class="muted" style="margin-left:auto">MM: <b class="mono">${fmt(s._ma5, 0)}</b></span>` : ""}
            </div>`;
          }).join("") || `<div class="empty">Sin resultados de resistencia.</div>`}
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Carta rápida — Resistencia @ 5 días + media móvil</h2><div class="spacer"></div>
        <button class="btn small" onclick="switchTab('charts')">Todas las cartas</button></div>
      <div class="panel-body"><div class="chart-scroll">${chartCS5(sets, 60)}</div></div>
    </div>`;
}

/* ------------------------------------------------------------ En Vivo */
function viewLive() {
  const days = testDates();
  const day = state.day && days.includes(state.day) ? state.day : days[0];
  state.day = day;
  const rows = testsOfDate(day);
  const last = rows[rows.length - 1];
  const cy = rows.reduce((a, t) => a + (num(t.vol) || 0), 0);
  const nRej = rows.filter((t) => t.rejected).length;
  const meta = db.dayMeta[day] || {};

  let verdictHtml = `<div class="empty">Sin camiones registrados para esta fecha.</div>`;
  if (last) {
    const w = worstZone(last);
    const cls = last.rejected || w === "susp" ? "susp" : w === "act" ? "act" : "ok";
    const label = last.rejected ? "✕ RECHAZADO" : w === "susp" ? "✕ FUERA DE LÍMITE" : w === "act" ? "⚠ ACEPTADO — ACCIÓN" : "✓ ACEPTADO";
    const cell = (k, v, z, u) => `<div class="live-cell ${z ? "lz-" + z : ""}">
      <div class="k">${k}</div><div class="v mono">${v == null ? "—" : fmt(v, 2)}<span class="u">${u}</span></div></div>`;
    verdictHtml = `
      <div class="live-verdict ${cls}">
        <div>
          <div class="lv-truck">Load #${rows.length} · Camión ${esc(last.truck || "—")} · Ticket <b>${esc(last.ticket || "—")}</b></div>
          <div class="lv-ident">${esc(shortIdent(last.ident))} · muestra ${esc(last.testTime || last.start || "—")}</div>
        </div>
        <div class="lv-status">${label}</div>
      </div>
      <div class="live-grid">
        ${cell("Slump (in)", last.slump, zoneSlump(last), '"')}
        ${cell("UW (pcf)", last.uw, zoneUW(last), "")}
        ${cell("Aire (%)", last.air, zoneAir(last), "%")}
        ${cell("Temp (°F)", last.temp, zoneTemp(last), "°")}
        <div class="live-cell"><div class="k">Hora</div><div class="v mono">${esc(last.end || last.testTime || last.start || "—")}</div></div>
      </div>
      ${last.rejected ? `<div style="margin-top:10px; text-align:right"><button class="btn danger" onclick="notifyReject(${last.n})">✉ Notificar rechazo a todas las partes</button></div>` : ""}`;
  }

  const alerts = trendAlerts(day);
  const h = lastHumidity(day);

  return `
    <div class="toolbar">
      <h2>Pantalla en vivo</h2>
      <select onchange="state.day=this.value; render()">
        ${days.map((d) => `<option value="${d}" ${d === day ? "selected" : ""}>${fmtDate(d)}</option>`).join("")}
      </select>
      <span class="muted" style="font-size:12.5px">${meta.fase ? "Fase " + esc(meta.fase) + " · " : ""}${meta.lane ? "Carril " + esc(meta.lane) : ""}</span>
      <div class="spacer"></div>
      <a class="btn" href="muestras.html" target="_blank">🧪 Muestras (iPad)</a>
      <a class="btn" href="display.html" target="_blank">🖥 Field Display</a>
      <button class="btn orange" onclick="formTest(null)">＋ Camión</button>
    </div>

    ${alerts.length ? `<div class="panel" style="border-left:4px solid var(--act)">
      <div class="panel-head"><h2>⚡ Avisos del sistema</h2><div class="spacer"></div>
        <span class="muted" style="font-size:12px">humedad: ${h ? "última " + esc(h.time) : "sin registro hoy"}</span>
        <button class="btn small" onclick="formHumidity()">＋ Humedad</button></div>
      <div class="panel-body flush">
        ${alerts.map((a) => `<div style="display:flex; gap:12px; padding:12px 16px; border-bottom:1px solid var(--line); align-items:flex-start">
          <span style="font-size:22px; line-height:1">${a.icon}</span>
          <div style="flex:1">
            <div style="font-weight:800; color:var(--${a.level === "susp" ? "susp" : "act"}); font-size:14px">${esc(a.title)}</div>
            <div style="font-size:13px; margin-top:2px">${esc(a.text)}</div>
            <div style="font-size:12.5px; color:var(--ink-soft); margin-top:3px">▸ ${esc(a.action)}</div>
          </div>
        </div>`).join("")}
      </div>
    </div>` : `<div class="notice ok" style="background:var(--ok-bg); color:var(--ok)">✓ Sin avisos — tendencias estables${h ? " · última humedad " + esc(h.time) : ""}
      <button class="btn small" style="margin-left:10px" onclick="formHumidity()">＋ Humedad</button></div>`}

    <div class="grid cols-3">
      <div class="stat"><div class="label">Yardas acumuladas</div><div class="value live-big">${fmt(cy, 1)}</div><div class="sub">CY · ${fmtDate(day)}</div></div>
      <div class="stat"><div class="label">Loads</div><div class="value live-big">${rows.length}</div><div class="sub">camiones</div></div>
      <div class="stat ${nRej ? "alert" : "good"}"><div class="label">Rechazados</div><div class="value live-big">${nRej}</div><div class="sub">hoy</div></div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-head"><h2>Último camión</h2></div>
      <div class="panel-body">${verdictHtml}</div>
    </div>

    <div class="grid cols-2">
      <div class="panel">
        <div class="panel-head"><h2>Slump — en vivo</h2><div class="spacer"></div>
          <span class="muted" style="font-size:12px">${trendLabel(day, "slump")}</span></div>
        <div class="panel-body"><div class="chart-scroll">${chartForDay(CHART_DEFS[0], day)}</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Peso unitario — en vivo</h2><div class="spacer"></div>
          <span class="muted" style="font-size:12px">${trendLabel(day, "uw")}</span></div>
        <div class="panel-body"><div class="chart-scroll">${chartForDay(CHART_DEFS[2], day)}</div></div>
      </div>
    </div>
    <div class="grid cols-2">
      <div class="panel">
        <div class="panel-head"><h2>Aire (%)</h2></div>
        <div class="panel-body"><div class="chart-scroll">${chartForDay(CHART_DEFS[1], day)}</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Temperatura (°F)</h2></div>
        <div class="panel-body"><div class="chart-scroll">${chartForDay(CHART_DEFS[3], day)}</div></div>
      </div>
    </div>`;
}


function formHumidity() {
  openForm({
    title: "Registrar prueba de humedad (planta)",
    initial: { date: state.day || todayISO(), time: nowHM(), plant: "01-SAN JUAN" },
    fields: [
      { key: "date", label: "Fecha", type: "date", required: true },
      { key: "time", label: "Hora", type: "time", required: true },
      { key: "plant", label: "Planta" },
      { key: "note", label: "Nota", full: true, placeholder: "Ej. humedad arena 4.2%" },
    ],
    onSave: (v) => { addHumidity(v); render(); toast("Humedad registrada"); },
  });
}

/* ------------------------------------------------------------ Daily sheet */
function viewDaily() {
  const days = testDates();
  if (!state.day || !days.includes(state.day)) state.day = days[0] || todayISO();
  const rows = testsOfDate(state.day);
  const meta = db.dayMeta[state.day] || {};
  const cy = rows.reduce((a, t) => a + (num(t.vol) || 0), 0);
  const nRej = rows.filter((t) => t.rejected).length;

  return `
    <div class="print-title">
      <h1>Hoja de Vaciado — ${fmtDate(state.day)}</h1>
      <div class="muted">${esc(db.project.name)} · ${esc(db.project.mixId)}${meta.fase ? " · Fase " + esc(meta.fase) : ""}${meta.lane ? " · Carril " + esc(meta.lane) : ""}</div>
    </div>

    <div class="toolbar">
      <h2>Vaciado diario</h2>
      <select onchange="state.day=this.value; render()">
        ${days.map((d) => `<option value="${d}" ${d === state.day ? "selected" : ""}>${fmtDate(d)}</option>`).join("")}
      </select>
      <button class="btn small" onclick="formDayMeta('${state.day}')">Editar fase/cierre</button>
      <div class="spacer"></div>
      <button class="btn" onclick="window.print()">🖨 Imprimir</button>
      <button class="btn orange" onclick="formTest(null)">＋ Camión</button>
    </div>

    <div class="panel"><div class="panel-body">
      <div class="day-meta">
        <div class="kv"><div class="k">Fase</div><b>${esc(meta.fase || "—")}</b></div>
        <div class="kv"><div class="k">Cierre</div><b>${esc(meta.cierre || "—")}</b></div>
        <div class="kv"><div class="k">Carril</div><b>${esc(meta.lane || "—")}</b></div>
        <div class="kv"><div class="k">Km</div><b>${esc(meta.km || "—")}</b></div>
        <div class="kv"><div class="k">Camiones</div><b>${rows.length}</b></div>
        <div class="kv"><div class="k">Volumen</div><b>${fmt(cy, 1)} CY</b></div>
        <div class="kv"><div class="k">Rechazados</div><b style="${nRej ? "color:var(--susp)" : ""}">${nRej}</b></div>
      </div>
    </div></div>

    <div class="panel"><div class="panel-body flush">
      ${rows.length ? `<div class="table-wrap"><table class="data">
        <tr><th>#</th><th>Losa / Identificación</th><th>Camión</th><th>Ticket</th>
            <th>Batch</th><th>Llegada</th><th>Comienza</th><th>Muestra</th><th>Termina</th><th class="num">Min</th>
            <th class="num">Slump (in)</th><th class="num">UW (pcf)</th><th class="num">Aire (%)</th><th class="num">Temp (°F)</th>
            <th>Estado</th><th>Comentarios</th><th class="no-print"></th></tr>
        ${rows.map((t) => {
          const el = minutesBetween(t.batch, t.end);
          return `<tr class="${t.rejected ? "rejected" : ""}">
            <td class="mono">${t.n}</td>
            <td style="white-space:normal; min-width:150px">${esc(shortIdent(t.ident))}</td>
            <td class="mono">${esc(t.truck || "—")}</td>
            <td class="mono"><b>${esc(t.ticket || "—")}</b></td>
            <td class="mono">${esc(t.batch || "—")}</td>
            <td class="mono">${esc(t.arrive || "—")}</td>
            <td class="mono">${esc(t.start || "—")}</td>
            <td class="mono">${esc(t.testTime || "—")}</td>
            <td class="mono">${esc(t.end || "—")}</td>
            <td${zClass(zoneElapsed(t))}>${el != null ? el : "—"}</td>
            <td${zClass(zoneSlump(t))}>${fmt(t.slump, 2)}</td>
            <td${zClass(zoneUW(t))}>${fmt(t.uw, 2)}</td>
            <td${zClass(zoneAir(t))}>${fmt(t.air, 1)}</td>
            <td${zClass(zoneTemp(t))}>${fmt(t.temp, 0)}</td>
            <td>${estadoBadge(t)}</td>
            <td style="white-space:normal; min-width:120px; font-size:12px">${esc(t.comments || "")}</td>
            <td class="no-print"><button class="btn link small" onclick="formTest(null,${t.n})">Editar</button>${t.rejected ? `<button class="btn link small" style="color:var(--susp)" onclick="notifyReject(${t.n})">✉</button>` : ""}</td>
          </tr>`;
        }).join("")}
      </table></div>` : `<div class="empty">Sin camiones para esta fecha — pulse “＋ Camión”.</div>`}
    </div></div>

    <p class="muted" style="font-size:12px">
      Colores: <span class="badge ok">OK</span> dentro de límites de acción ·
      <span class="badge act">ACCIÓN</span> entre acción y suspensión ·
      <span class="badge susp">SUSPENSIÓN</span> fuera de límites — según plan de control (pestaña Plan &amp; Datos).
      “Min” = minutos batch→termina (límite ${db.plan.maxElapsedMin}).
    </p>`;
}

/* ------------------------------------------------------------ All tests */
function viewTests() {
  let rows = sortedTests();
  const q = state.search.toLowerCase();
  if (q) rows = rows.filter((t) => [t.ticket, t.truck, t.ident, t.lot, t.date].join(" ").toLowerCase().includes(q));
  const total = rows.length;
  if (!state.showAll) rows = rows.slice(-120);

  return `
    <div class="toolbar">
      <h2>Registro de pruebas</h2>
      <input type="search" id="t-search" placeholder="Buscar ticket, losa, lote…" value="${esc(state.search)}"
        oninput="state.search=this.value; render(); focusTSearch()">
      <div class="spacer"></div>
      <span class="muted" style="font-size:12.5px">${state.showAll ? total : Math.min(120, total)} de ${total}</span>
      ${total > 120 ? `<button class="btn small" onclick="state.showAll=!state.showAll; render()">${state.showAll ? "Últimas 120" : "Ver todas"}</button>` : ""}
      <button class="btn" onclick="exportCSV()">⬇ CSV</button>
      <button class="btn orange" onclick="formTest(null)">＋ Prueba</button>
    </div>
    <div class="panel"><div class="panel-body flush">
      <div class="table-wrap" style="max-height:68vh; overflow-y:auto"><table class="data">
        <tr><th>#</th><th>Fecha</th><th>Ticket</th><th>Camión</th><th class="num">CY</th><th>Lote</th><th>Identificación</th>
            <th class="num">Slump</th><th class="num">Aire</th><th class="num">UW</th><th class="num">Temp</th>
            <th class="num">1d</th><th class="num">5d</th><th class="num">28d</th><th>Estado</th></tr>
        ${rows.map((t) => `<tr class="clickable ${t.rejected ? "rejected" : ""}" onclick="formTest(null,${t.n})">
          <td class="mono">${t.n}</td>
          <td class="mono">${esc(t.date)}</td>
          <td class="mono"><b>${esc(t.ticket || "—")}</b></td>
          <td class="mono">${esc(t.truck || "—")}</td>
          <td class="num mono">${fmt(t.vol, 1)}</td>
          <td class="mono">${esc(t.lot || "—")}</td>
          <td style="white-space:normal; min-width:170px; font-size:12px">${esc(shortIdent(t.ident))}</td>
          <td${zClass(zoneSlump(t))}>${fmt(t.slump, 2)}</td>
          <td${zClass(zoneAir(t))}>${fmt(t.air, 1)}</td>
          <td${zClass(zoneUW(t))}>${fmt(t.uw, 2)}</td>
          <td${zClass(zoneTemp(t))}>${fmt(t.temp, 0)}</td>
          <td class="num mono">${fmt(t.cs1, 0)}</td>
          <td${zClass(zoneCS5(t.cs5))}>${fmt(t.cs5, 0)}</td>
          <td class="num mono">${fmt(t.cs28, 0)}</td>
          <td>${estadoBadge(t)}</td>
        </tr>`).join("")}
      </table></div>
    </div></div>`;
}
function focusTSearch() {
  const el = document.getElementById("t-search");
  if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}

/* ------------------------------------------------------------ Strength */
function viewStrength() {
  const sets = strengthSets();
  const p = db.plan.cs;
  return `
    <div class="toolbar">
      <h2>Resistencias &amp; media móvil</h2>
      <div class="spacer"></div>
      <span class="muted" style="font-size:12.5px">Objetivo: ${fmt(p.target, 0)} psi @ ${p.age} días · Acción &lt; ${fmt(p.target, 0)} · Suspensión &lt; ${fmt(p.action, 0)} · Apertura al tráfico: ${fmt(p.openTarget, 0)} (mín ${fmt(p.openLow, 0)})</span>
    </div>
    <div class="panel"><div class="panel-body flush">
      ${sets.length ? `<div class="table-wrap" style="max-height:70vh; overflow-y:auto"><table class="data">
        <tr><th>Set</th><th>Fecha</th><th>Ticket</th><th>Camión</th><th>Identificación</th>
            <th class="num">1 día</th><th>Apertura (1d)</th><th class="num">${p.age} días</th><th class="num">28 días</th>
            <th class="num">Media móvil (${db.plan.maWindow})</th></tr>
        ${sets.map((s, i) => {
          const zma = s._ma5 == null ? null : (s._ma5 >= p.target ? "ok" : "susp");
          let open = "—";
          if (s.cs1 != null) {
            open = s.cs1 >= p.openTarget ? `<span class="badge ok">Sí (${fmt(s.cs1, 0)})</span>`
              : s.cs1 >= p.openLow ? `<span class="badge act">Marginal</span>`
              : `<span class="badge susp">No</span>`;
          }
          return `<tr>
            <td class="mono">${i + 1}</td>
            <td class="mono">${esc(s.date)}</td>
            <td class="mono"><b>${esc(s.ticket || "—")}</b></td>
            <td class="mono">${esc(s.truck || "—")}</td>
            <td style="white-space:normal; min-width:160px; font-size:12px">${esc(shortIdent(s.ident))}</td>
            <td class="num mono">${fmt(s.cs1, 0)}</td>
            <td>${open}</td>
            <td${zClass(zoneCS5(s.cs5))}><b>${fmt(s.cs5, 0)}</b></td>
            <td class="num mono">${fmt(s.cs28, 0)}</td>
            <td${zClass(zma)}>${fmt(s._ma5, 0)}</td>
          </tr>`;
        }).join("")}
      </table></div>` : `<div class="empty">Sin resultados de resistencia.</div>`}
    </div></div>
    <p class="muted" style="font-size:12px">Cada resultado es el promedio del set de cilindros rotos a esa edad (ASTM C39). La media móvil cubre los últimos ${db.plan.maWindow} sets con resultado a ${p.age} días.</p>`;
}

/* ------------------------------------------------------------ Charts */
function viewCharts() {
  const sets = strengthSets();
  const r = state.chartRange;
  const rangeSel = `<select onchange="state.chartRange=this.value==='all'?'all':Number(this.value); render()">
    ${[40, 80, 150].map((n) => `<option value="${n}" ${r === n ? "selected" : ""}>Últimas ${n}</option>`).join("")}
    <option value="all" ${r === "all" ? "selected" : ""}>Todas</option>
  </select>`;
  return `
    <div class="toolbar">
      <h2>Cartas de control</h2>
      ${rangeSel}
      <a class="btn primary" href="reporte.html">📄 Generar reporte</a>
      <div class="spacer"></div>
      <div class="chart-legend">
        <span><span class="sw" style="background:var(--chart-ok)"></span>OK</span>
        <span><span class="sw" style="background:var(--chart-act)"></span>Acción</span>
        <span><span class="sw" style="background:var(--chart-susp)"></span>Suspensión</span>
        <span><span class="sw" style="background:var(--chart-target); height:3px; margin-top:4px"></span>Objetivo</span>
        <span style="color:#c5221f; font-weight:700">✕ rechazado</span>
      </div>
    </div>
    ${CHART_DEFS.map((d) => `
      <div class="panel chart-block">
        <div class="panel-head"><h2>${esc(d.label)}</h2></div>
        <div class="panel-body"><div class="chart-scroll">${chartFor(d, r)}</div></div>
      </div>`).join("")}
    <div class="panel chart-block">
      <div class="panel-head"><h2>Resistencia @ ${db.plan.cs.age} días (psi) — puntos + media móvil (línea oscura)</h2></div>
      <div class="panel-body"><div class="chart-scroll">${chartCS5(sets, r)}</div></div>
    </div>`;
}

/* ------------------------------------------------------------ Plan & data */
function viewPlan() {
  const p = db.plan, pr = db.project;
  return `
    <div class="grid cols-2">
      <div class="panel">
        <div class="panel-head"><h2>Proyecto</h2><div class="spacer"></div><button class="btn small" onclick="formProject()">Editar</button></div>
        <div class="panel-body" style="font-size:14px">
          <p style="margin:4px 0"><b>${esc(pr.name)}</b></p>
          <p style="margin:4px 0" class="muted">Mezcla: ${esc(pr.mixId)}</p>
          <p style="margin:4px 0" class="muted">Contratista: ${esc(pr.contractor || "—")} · QC: ${esc(pr.qcFirm || "—")}</p>
          <p style="margin:4px 0" class="muted">Avisos de rechazo: ${esc(pr.notifyEmails || "— (configure emails)")}</p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Plan de control (límites SPC)</h2><div class="spacer"></div><button class="btn small" onclick="formPlan()">Editar</button></div>
        <div class="panel-body flush"><div class="table-wrap"><table class="data">
          <tr><th>Parámetro</th><th class="num">Objetivo</th><th class="num">Acción</th><th class="num">Suspensión</th></tr>
          <tr><td>Slump (in)</td><td class="num mono">${p.slump.target}</td><td class="num mono">${p.slump.actLo} – ${p.slump.actHi}</td><td class="num mono">${p.slump.suspLo} – ${p.slump.suspHi}</td></tr>
          <tr><td>Aire (%)</td><td class="num mono">${p.air.target}</td><td class="num mono">${p.air.actLo} – ${p.air.actHi}</td><td class="num mono">${p.air.suspLo} – ${p.air.suspHi}</td></tr>
          <tr><td>Peso unitario (pcf)</td><td class="num mono">${p.uw.target}</td><td class="num mono">± ${p.uw.act}</td><td class="num mono">± ${p.uw.susp}</td></tr>
          <tr><td>Temperatura (°F)</td><td class="num mono">—</td><td class="num mono">&gt; ${p.tempMax - 3}</td><td class="num mono">&gt; ${p.tempMax}</td></tr>
          <tr><td>Resistencia @ ${p.cs.age}d (psi)</td><td class="num mono">${fmt(p.cs.target, 0)}</td><td class="num mono">&lt; ${fmt(p.cs.target, 0)}</td><td class="num mono">&lt; ${fmt(p.cs.action, 0)}</td></tr>
          <tr><td>Apertura al tráfico (psi)</td><td class="num mono">${fmt(p.cs.openTarget, 0)}</td><td class="num mono" colspan="2">mínimo ${fmt(p.cs.openLow, 0)}</td></tr>
          <tr><td>Batch → descarga (min)</td><td class="num mono">—</td><td class="num mono" colspan="2">máx ${p.maxElapsedMin}</td></tr>
        </table></div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Exportar &amp; respaldo</h2></div>
        <div class="panel-body">
          <div style="display:flex; gap:10px; flex-wrap:wrap">
            <button class="btn" onclick="exportCSV()">⬇ CSV (todas las pruebas)</button>
            <button class="btn primary" onclick="backupJSON()">⬇ Respaldo (.json)</button>
            <label class="btn">⬆ Restaurar respaldo<input type="file" accept=".json" style="display:none" onchange="restoreJSON(this)"></label>
          </div>
          <p class="muted" style="font-size:12.5px">Los datos viven en este navegador. Descargue un respaldo al final de cada día de vaciado.</p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Zona de peligro</h2></div>
        <div class="panel-body">
          <button class="btn danger" onclick="resetSeed()">Restaurar historial original (borra cambios)</button>
          <p class="muted" style="font-size:12.5px">Vuelve a las ${QC_SEED.tests.length} pruebas importadas del Excel de Segarra (25 nov 2025 – 18 jul 2026).</p>
        </div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------ backup / restore */
function backupJSON() {
  downloadFile(`qc-pr52-respaldo-${todayISO()}.json`, JSON.stringify(db, null, 1), "application/json");
  toast("Respaldo descargado");
}
function restoreJSON(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.tests) || !data.plan) throw new Error("No es un respaldo de QC");
      if (!confirm(`¿Restaurar respaldo con ${data.tests.length} pruebas? Reemplaza TODOS los datos actuales.`)) return;
      db = data; saveDB(); render(); toast("Respaldo restaurado");
    } catch (e) { alert("No se pudo restaurar: " + e.message); }
  };
  reader.readAsText(file);
  input.value = "";
}
function resetSeed() {
  if (!confirm("¿Restaurar el historial original del Excel? Se pierden los cambios hechos en la app.")) return;
  db = {
    version: 1,
    project: structuredClone(QC_SEED.project),
    plan: structuredClone(QC_SEED.plan),
    tests: structuredClone(QC_SEED.tests),
    dayMeta: db.dayMeta || {},
  };
  saveDB(); render(); toast("Historial restaurado");
}

/* ------------------------------------------------------------ meta forms */
function formDayMeta(day) {
  const meta = db.dayMeta[day] || {};
  openForm({
    title: `Datos del vaciado — ${fmtDate(day)}`,
    initial: meta,
    fields: [
      { key: "fase", label: "Fase" },
      { key: "cierre", label: "Cierre" },
      { key: "lane", label: "Carril", placeholder: "L1 / L2 / L3" },
      { key: "km", label: "Km (desde–hasta)", half: true, placeholder: "0.943 – 0.461" },
      { key: "notas", label: "Notas", type: "textarea", full: true },
    ],
    onSave: (v) => { db.dayMeta[day] = v; saveDB(); render(); toast("Datos del día guardados"); },
  });
}
function formProject() {
  openForm({
    title: "Proyecto",
    initial: db.project,
    fields: [
      { key: "name", label: "Proyecto", full: true, required: true },
      { key: "mixId", label: "Mezcla / Mix ID", full: true },
      { key: "contractor", label: "Contratista" },
      { key: "qcFirm", label: "Firma QC" },
      { key: "notifyEmails", label: "Emails para avisos de rechazo", full: true, placeholder: "a@dvg.com, b@segarra.com, inspector@act.pr.gov" },
    ],
    onSave: (v) => { Object.assign(db.project, v); saveDB(); render(); toast("Proyecto actualizado"); },
  });
}
function formPlan() {
  const p = db.plan;
  openForm({
    title: "Plan de control — límites SPC",
    initial: {
      sT: p.slump.target, sAL: p.slump.actLo, sAH: p.slump.actHi, sSL: p.slump.suspLo, sSH: p.slump.suspHi,
      aT: p.air.target, aAL: p.air.actLo, aAH: p.air.actHi, aSL: p.air.suspLo, aSH: p.air.suspHi,
      uT: p.uw.target, uA: p.uw.act, uS: p.uw.susp,
      tMax: p.tempMax, cT: p.cs.target, cAge: p.cs.age, cA: p.cs.action, cOT: p.cs.openTarget, cOL: p.cs.openLow,
      maW: p.maWindow, elMax: p.maxElapsedMin,
    },
    fields: [
      { type: "label", label: "Slump (in)" },
      { key: "sT", label: "Objetivo", type: "number", step: "0.25" },
      { key: "sAL", label: "Acción mín", type: "number", step: "0.25" },
      { key: "sAH", label: "Acción máx", type: "number", step: "0.25" },
      { key: "sSL", label: "Suspensión mín", type: "number", step: "0.25" },
      { key: "sSH", label: "Suspensión máx", type: "number", step: "0.25" },
      { type: "label", label: "Aire (%)" },
      { key: "aT", label: "Objetivo", type: "number", step: "0.1" },
      { key: "aAL", label: "Acción mín", type: "number", step: "0.1" },
      { key: "aAH", label: "Acción máx", type: "number", step: "0.1" },
      { key: "aSL", label: "Suspensión mín", type: "number", step: "0.1" },
      { key: "aSH", label: "Suspensión máx", type: "number", step: "0.1" },
      { type: "label", label: "Peso unitario (pcf)" },
      { key: "uT", label: "Objetivo", type: "number", step: "0.1" },
      { key: "uA", label: "Acción ±", type: "number", step: "0.1" },
      { key: "uS", label: "Suspensión ±", type: "number", step: "0.1" },
      { type: "label", label: "Temperatura y descarga" },
      { key: "tMax", label: "Temp máx (°F)", type: "number", step: "1" },
      { key: "elMax", label: "Batch→descarga máx (min)", type: "number", step: "5" },
      { type: "label", label: "Resistencia (psi)" },
      { key: "cT", label: "Objetivo f'c", type: "number", step: "50" },
      { key: "cAge", label: "Edad (días)", type: "number", step: "1" },
      { key: "cA", label: "Límite acción (susp. si <)", type: "number", step: "50" },
      { key: "cOT", label: "Apertura tráfico objetivo", type: "number", step: "50" },
      { key: "cOL", label: "Apertura tráfico mínimo", type: "number", step: "50" },
      { key: "maW", label: "Ventana media móvil", type: "number", step: "1" },
    ],
    onSave: (v) => {
      db.plan = {
        slump: { target: v.sT, actLo: v.sAL, actHi: v.sAH, suspLo: v.sSL, suspHi: v.sSH },
        air: { target: v.aT, actLo: v.aAL, actHi: v.aAH, suspLo: v.aSL, suspHi: v.aSH },
        uw: { target: v.uT, act: v.uA, susp: v.uS },
        tempMax: v.tMax, maxElapsedMin: v.elMax,
        cs: { target: v.cT, age: v.cAge, action: v.cA, openTarget: v.cOT, openLow: v.cOL },
        maWindow: v.maW,
      };
      saveDB(); render(); toast("Plan de control actualizado");
    },
  });
}

/* ------------------------------------------------------------ boot */
document.getElementById("main-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-tab]");
  if (btn) switchTab(btn.dataset.tab);
});
loadDB();
initTheme();
mountThemeToggle();
enableLiveSync(() => render());
document.getElementById("brand-subtitle").textContent =
  db.project.name + " · " + (db.project.qcFirm || "QC");
render();
