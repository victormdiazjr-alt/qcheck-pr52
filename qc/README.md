# QC — Control de Hormigón PR-52 (prototipo 2 · multi-usuario)

**Start here: open `portal.html`** — it routes each user to their screen. All screens share
one live database (open several windows side by side and they update each other instantly):

| Screen | File | User | Design intent |
|---|---|---|---|
| Portal | `portal.html` | everyone | Entry point, role cards |
| Control Center | `index.html` | QC engineer (Segarra) | Full app: daily sheet, tests, strength, SPC charts, control plan, exports |
| Pantalla de Campo | `display.html` | truck drivers / crew | **Street-sign concept**: MUTCD highway-green panels, giant lettering readable in motion; flips green ✓ ACEPTADO / red ✕ RECHAZADO; yards, loads, clock. Tap = fullscreen. For a TV/tablet at the pour |
| Conduce | `conduce.html` | field data-entry person | QR scan (camera), photo of the conduce as attached evidence, big-button manual entry, one-tap AHORA timestamps per stage, live verdict on results |
| Producción | `produccion.html` | plant + contractor | Trucks on site, CY/hr, cycle vs 90-min limit, waits, cumulative yards curve, per-truck cycle bars, 7-day comparison |
| Autoridad / FHWA | `autoridad.html` | PRHTA / FHWA (read-only) | English executive view: compliance donuts, strength & moving average, all SPC charts, lot summary, rejected-loads log, CSV |

Shared engine: `core.js` (storage, SPC zones, charts, forms, cross-window sync) + `seed.js`
(397 real tests). Same-device windows sync via browser storage events; true multi-device
sync is the next milestone (needs a backend).

---

## Prototipo 1 notes (still valid)

Reverse-engineered from **Segarra's control chart workbook** (`DVG - Concrete Control
Charts.xlsx`) and DVG's paper **hoja de vaciado**. Ships pre-loaded with the real project
history: **397 tests, 29 pour days, 3,884 CY (Nov 25 2025 – Jul 18 2026)** on mix
**AC300503SX — 3000 PSI @ 5 days (SP-503)**.

Open `index.html` in a browser (or serve the project root: `node ../serve.js` → `/qc/`).

## What was reverse-engineered

| Element | Source | Rule |
|---|---|---|
| SPC zones | Excel limit columns | OK (within action) / **Acción** (action↔suspension) / **Suspensión** (beyond) |
| Slump | target 3.0" | action 2.0–4.0" · suspension 1.5–4.5" |
| Aire | target 2.0% | action 0.5–4.0% · suspension 0.0–4.5% |
| Peso unitario | target 150.1 pcf (was 149.9/150.5 — stored per-test) | action ±2.3 · suspension ±3.0 |
| Resistencia | 3,000 psi @ 5 días | action < 3,000 · suspension < 2,500 |
| Media móvil | `=AVERAGE(K2:K7)` | 6-set moving average of 5-day strength (verified: 5,885 first value) |
| Apertura al tráfico | Moving Average sheet | target 2,500 psi · low limit 2,200 psi |
| Hoja de vaciado | paper form photo | per-truck: losa, camión, ticket, batch/llegada/comienza/muestra/termina, slump, UW, aire, temp, aceptado/rechazado |

## Tabs

- **Panel** — stats, alerts (MA below target, suspension-zone tests, action-zone trends)
- **Vaciado Diario** — the paper form, digital: per-day truck table with live zone coloring and print layout; fase/cierre/carril/km editable per day
- **Pruebas** — full searchable log (all 397+)
- **Resistencias** — sets @ 1/5/28 días, apertura al tráfico, media móvil
- **Cartas de Control** — SVG SPC charts (slump, aire, UW, temp, resistencia + MA) with target/action/suspension bands; rejected loads marked ✕
- **Plan & Datos** — editable control plan, CSV export, JSON backup/restore, reset to original history

Data lives in the browser (localStorage, key `qc-pr52-db-v1`). Download a backup at the end
of each pour day (Plan & Datos).

## Requirements confirmed from the Ruben Segarra conversation (WhatsApp, Jul 2026)

- The master table is where everything is entered; the last columns hold every limit ✓ (Pruebas tab + Plan de control)
- Goal: **run live** — field crew enters data, the whole team sees what's running and whether each truck is accepted ✓ (En Vivo tab + live verdict while typing)
- Display fields per Ruben: **yardas acumuladas, número de load, slump, temperatura, UW, hora** ✓ (En Vivo board)
- **Running control chart of the current pour** ("la gráfica es más cool… se ve rápido los límites") ✓ (day charts on En Vivo)
- **Control charts are the FHWA deliverable** ✓ (Cartas de Control)
- Agreed workflow: conduce arrives → scan → tests → submitting tests yields truck status → **rejection emails all parties** ✓ partially (✉ Notificar rechazo builds a prefilled email; ticket *scanning* and automatic sending are next-milestone)

## Next milestones (need decisions)

1. **True multi-device live sync** — today data lives in one browser. Options: hosted backend, or a shared-state web deployment. This is the "correr en vivo" piece for the whole team.
2. **Conduce scanning** — camera barcode/OCR capture of the delivery ticket at arrival.
3. **Automatic rejection emails** — needs a mail service (currently opens a prefilled email for one tap-send).

## Assumptions still to confirm with Ruben

1. **Apertura al tráfico** evaluated here on the 1-day break vs 2,500/2,200 psi — confirm age/criterion.
2. **Temp limit** 95 °F max (ACI 305 typical) — Excel has no temp limits; the paper form logs temp only.
3. Moving-average window of 6: informational vs. lot acceptance.
4. Whether "Losas a Trabajar" planning (espesor → yds table on the paper form) should become a pour-planning feature.
