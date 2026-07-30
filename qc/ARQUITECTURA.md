# Arquitectura — Dos herramientas, un core
### Definido por Víctor, 30 jul 2026 (post-llamada con Rubén)

No son cambios al sistema actual: es **añadir e interconectar**. Lo construido sigue válido.

---

## El core

Una sola **base de datos central**. Su unidad es el **record del conduce**.
Ese record **nace en la planta** (no en QCheck) y se va enriqueciendo a lo largo del viaje.

```
                    ┌──────────────────────────────┐
                    │   CORE — record por conduce  │
                    │   (QR = identificador único) │
                    └──────────────────────────────┘
                        ▲                    ▲
            crea        │                    │   enriquece
                        │                    │
        ┌───────────────┴──────┐   ┌─────────┴─────────────────┐
        │  e-TICKET            │   │  QCheck                   │
        │  (Concretera)        │   │  (Segarra Engineering)    │
        └──────────────────────┘   └───────────────────────────┘
```

---

## Herramienta 1 — e-Ticket (del concretero)

**Producto aparte. Cliente: la concretera.**

1. Se carga el camión.
2. Se **genera el ticket con QR code** → ese QR **es el conduce**.
3. Se **crea el record** en el core con la información de origen:
   número de conduce, camión, planta, hora de cargado, mezcla, volumen, productor.
4. El chofer llega a la obra y **entrega el ticket**.
5. **Ahí termina esta herramienta.**

## Herramienta 2 — QCheck (la que estamos construyendo)

**Cliente: Segarra Engineering / el contratista.** Toma el relevo cuando el camión llega.

1. **Escanea el QR** → entra automáticamente toda la info del conduce.
2. Registra que **llegó un camión**.
3. Arranca la rutina: **tomar muestras y hacer pruebas**.
4. El **Field Display** da estatus de todo el proceso en tiempo real.
5. Cuando hay resultados → el display **canta el veredicto** (aceptado / rechazado).
6. Todos los resultados se guardan **en el mismo record del conduce**.
7. De ahí se alimentan las vistas por rol y, si la concretera es cliente nuestro,
   **QCheck le devuelve la información de cada conduce a su e-Ticket**.

---

## Inventario de pantallas de QCheck

| # | Pantalla | Usuario | Estado |
|---|---|---|---|
| 1 | **Recepción / Escaneo** | técnico en la entrada | ✅ existe (`conduce.html`) — simplificar a escanear |
| 2 | **Muestras (iPad)** — entrada de resultados | técnico de pruebas | ⬜ **NUEVA — hay que construirla** |
| 3 | **Field Display** | choferes y crew | ✅ existe (`display.html`) |
| 4 | **Contratista** | contratista | ⬜ falta (ver ROADMAP §2) |
| 5 | **Productor** | concretera | ✅ existe (`produccion.html`) — quitar datos del proyecto |
| 6 | **Control Center** | Rubén (admin) | ✅ existe (`index.html`) |
| 7 | **Autoridad** | Carreteras/FHWA | ✅ existe — baja prioridad |

---

## Pantalla nueva — "Muestras" (entrada de resultados en iPad)

**El requisito clave: se opera con las manos sucias, de pie, junto al camión.**

- **Diseño:** mismo lenguaje visual del Field Display — fondo oscuro, tipografía enorme,
  glow de estado. Debe verse claro bajo sol y a un brazo de distancia.
- **Formato:** iPad, horizontal, botones grandes tipo touchscreen. **Nada de campos pequeños
  ni teclado del sistema**: steppers grandes (+ / −) y teclado numérico propio de botones gordos.
- **Contexto visible siempre:** qué camión / conduce se está probando (número grande, ticket, planta).
- **Campos:** slump, peso unitario, aire, temperatura. (Confirmar si también cilindros moldeados
  y horas de muestra/inicio/fin.)
- **Retroalimentación inmediata:** cada valor se colorea al entrarlo, igual que el Field Display
  (verde / ámbar cerca del límite / rojo fuera).
- **Submit:** al dar **SUBMIT**, se calcula el veredicto, se guarda en el record del conduce
  y **el Field Display anuncia aceptado o rechazado** con su sonido.
- Confirmación antes de enviar un rechazo (tiene consecuencias: correo a todas las partes).

---

---

## Decisiones confirmadas (30 jul 2026)

### 1. Concretera que NO es cliente — el caso de hoy

Trae **su propio conduce en papel**. Entonces:

- QCheck **crea el record**, con **clave compuesta: compañía + número de conduce**.
  Los números de conduce se repiten entre plantas distintas; la compañía evita todo conflicto.
- **Se le toma una foto al conduce y el sistema entra la data automáticamente** (OCR).
  Esto sube de prioridad: deja de ser "futuro" y pasa a ser **la vía principal de entrada
  del primer release**, porque hoy ninguna planta genera nuestro QR.
- La foto queda adjunta al record como evidencia.

**Dos modos de entrada, mismo resultado:**

| Origen | Cómo entra | Record |
|---|---|---|
| Concretera **cliente** | escanea el QR | ya existe, se enriquece |
| Concretera **no cliente** | foto del conduce → OCR (o manual) | lo crea QCheck, clave = compañía + conduce |

### 2. Recepción y Muestras — misma persona, por ahora

Un solo iPad, dos pasos del mismo flujo. Se diseñan como pantallas separadas
(el flujo puede dividirse después sin rehacer nada), pero se opera corrido.

### 3. Qué devuelve QCheck al e-Ticket

**Toda la información disponible** del conduce. Si esa integración se concreta,
la manejamos nosotros de nuestro lado.

### 4. El QR es una llave, no una copia de los datos

*(Resuelto por el requisito: "no importa quién lo escanee ni cuándo, que salga toda la
info de ese conduce que exista hasta el momento".)*

Si el QR llevara los datos **adentro**, quedarían **congelados en el momento de imprimir**
el ticket: nunca traería los resultados de las pruebas, porque todavía no existían.
Por eso:

- El QR carga un **identificador único permanente** del viaje.
- Al escanearlo, QCheck **consulta el core y trae el estado actual completo** del record —
  origen, llegada, pruebas, veredicto, cilindros, fotos: todo lo que exista hasta ese momento.
- Escanearlo dos días después devuelve más información que escanearlo al llegar. Ese es el punto.

### 5. Cámara del dispositivo: iPhone / iPad

El escaneo y la foto se hacen con la cámara del iPhone o iPad. Realidad técnica a resolver:

| Vía | iPhone / iPad (Safari) | Estado |
|---|---|---|
| **Foto del conduce** (`capture="environment"`) | ✅ funciona | implementado — queda adjunta al record |
| **Cámara en vivo** (`getUserMedia` + `playsinline`) | ✅ funciona | implementado |
| **Lectura de QR en el navegador** (`BarcodeDetector`) | ❌ **no existe en Safari** | detectado: la app avisa y ofrece foto o manual |

**Decisión pendiente para que el QR funcione en iPhone/iPad — dos caminos:**

1. **Incorporar un decodificador de QR en JavaScript** (tipo `jsQR`, MIT, ~40 KB) que lee los
   fotogramas de la cámara. Funciona en todos los navegadores y **sin internet**.
   Es una dependencia de terceros que habría que revisar y guardar dentro del proyecto.
2. **App nativa iOS** (o envoltura tipo PWA con plugin): usa el lector del sistema, el mejor
   rendimiento, pero implica publicar en App Store / distribución interna.

Mientras tanto, en iPhone/iPad el flujo real es: **Foto del conduce → confirmar ticket → probar**,
que además es exactamente el caso de la concretera que no es cliente.

**Recomendación técnica (respaldo sin señal):** que el QR lleve el identificador **más un
resumen mínimo del origen** (conduce, camión, planta, hora de cargado, volumen, mezcla).
Así, si en el tramo no hay señal, QCheck igual reconoce el camión y opera; cuando vuelve
la conexión, sincroniza y completa. Sin esto, un QR "solo ID" es inútil sin internet —
y esto es carretera.
