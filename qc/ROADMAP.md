# QC — Backlog de modificaciones
### Derivado de la llamada con Rubén Segarra (30 jul 2026)

Estado: ✅ = construido y verificado · ⬜ = pendiente.

**Entregado 30 jul 2026:** pantalla **Muestras (iPad)**, **dashboard Contratista**,
**capa de alertas inteligentes**, registro de humedades, gráficas live con tendencia,
plan del día (losas + yardas), privacidad del productor, clave compuesta del conduce,
y el Field Display anunciando el veredicto al recibir resultados.

---

## 0. Cambios estratégicos (afectan todo lo demás)

| Antes asumíamos | La llamada confirmó |
|---|---|
| El cliente principal era la Autoridad/FHWA | **El cliente es el CONTRATISTA.** La industria se mueve a que el contratista haga su propio QC y documente todo. Carreteras participa lo mínimo |
| App de QC para un proyecto | **Una sola plataforma con productos por rol**: QC, contratista, productor, y a futuro entidad supervisora |
| El registro base es una "prueba" | **El registro base es el CONDUCE.** Un record único por conduce; todo lo demás (pruebas, cilindros, fotos, pesadas, rechazo) vive dentro de ese record |
| Excel se complementa | **Excel se reemplaza.** Queda solo como formato de exportación |

**Prioridades confirmadas por Rubén:**
- **Goal #1 — QC durante el tiro** (eliminar el papel y el doble data entry)
- **Goal #2 — e-Ticket para la concretera**
- Todo lo demás puede esperar.

---

> **Ver primero [ARQUITECTURA.md](ARQUITECTURA.md)** — dos herramientas (e-Ticket de la concretera
> y QCheck de Segarra) sobre un mismo core. El record del conduce **nace en la planta**;
> QCheck lo enriquece. Incluye la especificación de la pantalla nueva de **Muestras (iPad)**.

## 1. Modelo de datos — refactor al "record por conduce"

- [ ] Renombrar el registro base de *test* a **conduce** (`id` = número de conduce).
- [ ] Campos mínimos del conduce: **número de conduce, número de camión, planta, hora de cargado (batch), datos del productor**. Rubén confirmó que **la planta sí importa**.
- [ ] Convertir el registro en **línea de tiempo de eventos** (event-driven), no campos sueltos:
  `salida de planta → llegada → toma de muestra → resultados → aceptación/rechazo → inicio vaciado → fin vaciado → cilindros → roturas`
- [ ] Adjuntos dentro del mismo record: **foto del conduce escaneado, pesadas, fotos de la losa, fotos de cilindros**.
- [ ] Campo **hora de salida de planta** (checkpoint futuro; Rubén: *"no me puedo meter en eso todavía"* — dejar el campo listo, no automatizar aún).
- [ ] Arquitectura preparada para **sensores futuros**.

## 2. Dashboard CONTRATISTA — **no existe, es el cliente principal**

Rubén lo definió con precisión:

- [x] **Yardas colocadas** ✅
- [x] **Yardas pendientes** ✅ (plan del día editable)
- [x] **Camiones esperando** ✅
- [x] **Progreso del tiro** (%) ✅
- [x] **Conteo de losas** ✅ — plan de losas del día + conteo automático por identificación de losa en los camiones descargados
- [x] **Estado de cumplimiento** ✅ — banner "todo en cumplimiento / con avisos / fuera", sin detalle técnico
- [x] Optimizado para **teléfono** ✅
- [x] **NO incluye** yardas por hora ni productividad ✅ — Rubén dijo que en tiro de losas no importan (empezaste, tienes que terminar)

## 3. Dashboard PRODUCTOR (Concretera) — ajustar el existente

- [ ] Todo lo del contratista **+** producción, **yardas por hora**, eficiencia, indicadores internos de planta ✅ (mayormente hecho)
- [x] **Tendencias de calidad** en vivo ✅
- [x] **Privacidad: proyecto oculto al productor** ✅ — Hoy mostramos identificación de losa y datos del proyecto; el productor no debe ver eso — solo lo relacionado al camión y su producción
- [ ] Este es el **e-Ticket** (Goal #2)

## 4. Dashboard QC (Control Center) — lo que Rubén realmente usa

- [x] **Gráficas LIVE de Peso Unitario y Slump con tendencia** ✅ — fue lo más repetido de toda la llamada. Él no lee la tabla: mira *dónde está* en peso unitario y slump
- [x] Tabla live limpia ✅
- [x] Alertas en la pestaña En Vivo ✅ (ver §5)

## 5. ⭐ Capa de inteligencia — alertas y recomendaciones

El hallazgo más valioso de la llamada. La app deja de ser un registro y se vuelve **asesor**:

- [x] **Regla agua** ✅: peso unitario bajando **+** slump subiendo → *"Posible exceso de agua — verificar humedades"*
- [x] **Regla tendencia** ✅: peso unitario yéndose (arriba o abajo) de forma sostenida → avisar antes de salirse de límite
- [x] **Registro de humedades** ✅
- [x] **Regla humedad** ✅: *"última humedad hace más de 3 horas"* → recordatorio automático
- [ ] Base para reglas automáticas y, más adelante, IA

> Contexto de Rubén: los primeros tiros con Concretec fueron solo para darles datos; después ellos aprendieron a reaccionar. Él es hoy quien alimenta a la planta manualmente — la app debe hacerlo sola.

## 6. Dashboard CARRETERAS / Autoridad — bajar prioridad

- [ ] Rubén: a Carreteras le interesa **el resumen**, no seguir el tiro en vivo: cuántas pruebas cumplieron, cuántas se rechazaron, cómo terminó el proyecto ✅ (nuestra pantalla ya es de resumen — se mantiene, pero deja de ser prioridad)

## 7. Entrada / e-Ticket

- [ ] **OCR del conduce en papel** — vía principal del primer release (hoy ninguna planta
      genera nuestro QR). Foto → el sistema entra la data solo. Evaluar OCR en el dispositivo
      (Live Text / Vision de iOS, sin señal) vs. servicio en la nube
- [x] **Clave compuesta compañía + número de conduce** ✅
- [ ] QR = identificador permanente + resumen mínimo del origen (para operar sin señal)

- [ ] Rubén validó el concepto: **escanear conduce → aparece en pantalla → se guarda todo en el backend** ✅ (existe en Conduce + Field Display)
- [ ] El conduce lo generará la planta como **"hojita tipo parking" con QR** — coordinar formato con la concretera
- [ ] Entrada manual siempre disponible como respaldo ✅
- [ ] **Eliminar el papel por completo**: el técnico hace el data entry desde el teléfono (objetivo más repetido de la llamada)

## 8. Infraestructura — el bloqueador real

- [ ] **Backend con base de datos centralizada** — todo lo anterior depende de esto. Hoy los datos viven en un solo navegador
- [ ] Sincronización real multi-dispositivo (campo, planta, contratista, QC)
- [ ] **Emails automáticos por rechazo** (hoy: correo pre-llenado con un toque; falta el envío automático)
- [ ] Roles y permisos (el productor no ve datos del proyecto)

## 9. Investigación futura

- [ ] **ArcGIS**: la inspección ya lo usa para georreferenciar losas, registrar reparaciones y tomar fotos parado en la losa. Evaluar integración
- [ ] Modelo comercial: una plataforma, módulos por cliente (productor / contratista / QC / supervisor)

---

## Preguntas abiertas para la próxima llamada

1. Formato exacto del QR que generará la planta (¿qué campos trae el conduce?)
2. ¿De dónde sale el **plan del día**: cantidad de losas y yardas planificadas? ¿Lo entra el contratista o QC?
3. ¿Qué significa "camión esperando" operativamente — llegó a sitio, o ya en fila para descargar?
4. Umbrales exactos de las alertas de tendencia (cuántas lecturas seguidas, cuánta desviación)
5. ¿Quién registra las humedades de la planta — Concretec entra el dato o lo anota QC?
