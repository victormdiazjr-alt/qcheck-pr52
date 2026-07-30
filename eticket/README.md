# e-Ticket — herramienta de la concretera

Genera el conduce con código QR cuando se carga el camión, crea el record de origen y
le muestra a la planta su producción y la calidad que el laboratorio le devuelve.
Cuando el chofer sale con el ticket, esta herramienta terminó su trabajo.

Producto **independiente** de QCheck. No comparte código de producto con él:
lo único común es `../shared/conduce-contract.js` (**contrato v2**).

---

## Cómo se abre

Doble clic en `index.html`, o servido:

```
node serve.js 8452          # desde la raíz del proyecto
http://localhost:8452/eticket/
```

Sin paso de compilación, sin dependencias, sin internet.
La primera vez lleva al **setup**: sin configurar no se puede despachar.

---

## Pantallas

| Archivo | Qué es |
|---|---|
| `setup.html` + `setup.js` | configuración inicial y ajustes (compañía, plantas, mezclas, numeración, papel) |
| `index.html` + `eticket.js` | **Despacho / Carga** — cargar camión, generar ticket, hojita, tickets de hoy |
| `produccion.html` + `produccion.js` | **Tablero de producción** — ritmo, ciclos y calidad devuelta |
| `config.js` | configuración del producto (clave propia, no toca el conduce ni el contrato) |
| `qr.js` | **codificador QR propio**, JavaScript puro |
| `eticket.css` | estilos, tema claro/oscuro, maqueta de impresión |

---

## Setup / ajustes

Nada se infiere del histórico y nada viene quemado en el código. El catálogo lo entra
la concretera y vive bajo su propia clave: `eticket-config-v1`.

- **Compañía** — la pantalla explica que forma parte de la llave del conduce.
- **Plantas** — lista editable (añadir / renombrar / eliminar), una predeterminada.
- **Mezclas** — códigos con descripción opcional, una predeterminada.
- **Numeración** — desde qué número arranca la secuencia. Cada ticket avanza el contador.
- **Papel del ticket** — Automático / 58 mm / 80 mm / Letter-A4.

Se puede volver a abrir cuando se quiera desde **Ajustes**. Si alguien abre la herramienta
sin configurar, se le lleva al setup antes de poder despachar. Los ejemplos que aparecen
en los campos son solo placeholders, nunca valores por defecto.

Ya configurada, el formulario de despacho usa **selectores** de planta y mezcla: menos
errores de tecleo en la caseta.

---

## Despacho

Conduce (del contador), camión, planta, mezcla, volumen con steppers, hora de cargado
con botón **AHORA**. Al generar: valida, rechaza duplicados por llave, crea el record,
abre la hojita y avanza el contador.

La lista del día muestra los tickets de esta compañía con su estado, **leído** del
record (nunca recalculado aquí):

| Estado | Cuándo |
|---|---|
| Despachado | el record solo tiene datos de origen |
| Recibido | QCheck marcó llegada (`arrive` / `start` / `end`) |
| Resultado | QCheck escribió pruebas |
| Rechazado | QCheck marcó `rejected` |

Clic en una fila reimprime ese ticket. Si QCheck escribe desde otra ventana, la lista
se actualiza sola (evento `storage`).

---

## Tablero de producción

- **Camiones despachados, volumen (CY), en ruta, con resultado, rechazados.**
- **Ritmo** — primera y última carga, ventana, CY/hora, cargas/hora, intervalo entre
  cargas, volumen por carga.
- **Tiempos de ciclo** — planta→obra, espera en obra, descarga, ciclo completo y el peor
  ciclo del día.
- **Calidad devuelta por el laboratorio** — revenimiento, peso unitario y temperatura:
  último valor, promedio, **σ** (uniformidad de la producción), rango y **tendencia**
  (últimas 3 cargas contra las 3 anteriores), con minigráfico y los rechazos en rojo.
  Todo evaluado contra la **especificación publicada** (ver abajo).
- **Camiones del día** en tabla, filtrable por planta y por fecha, con las lecturas
  coloreadas por zona.

### Límites de especificación (contrato v3)

**QCheck los publica, e-Ticket solo los lee.** Los límites salen del diseño de mezcla
aprobado del proyecto, no de la planta: si cada concretera entrara los suyos, podría
creerse dentro de rango mientras QC la rechaza. Por eso **no están en el setup** y esta
herramienta **nunca llama a `publishMixSpec`** — solo `readMixSpec`, `zoneAgainstSpec`
y `mixCodeOf`.

- Verde dentro, **ámbar** en zona de acción, **rojo** fuera — el mismo código del resto
  del sistema. El ámbar de zona nunca se confunde con el naranja de marca: en las
  tarjetas de calidad la línea del gráfico va en gris neutro y el color lo llevan los
  puntos, el valor y las bandas.
- Cada lectura se evalúa contra la especificación de **su propia mezcla**. Las bandas del
  minigráfico solo se dibujan si todas las cargas del día comparten una misma
  especificación; con mezclas distintas los límites no son comparables en un gráfico.
- Debajo de cada valor se imprimen los límites vigentes
  (p. ej. `acción 2"–4" · límite 1.5"–4.5"`).
- **Aviso de tendencia** — lo que Rubén pidió, que la planta corrija *antes* de seguir
  produciendo fuera de rango:

  | Aviso | Cuándo |
  |---|---|
  | `fuera de límite` (rojo) | el último valor está fuera |
  | `en zona de acción` (ámbar) | el último valor está entre acción y límite |
  | `acercándose al límite` (ámbar) | el valor todavía está bien, pero **el próximo movimiento del mismo tamaño lo saca de rango** |

- **Si QC todavía no ha publicado** los límites de esa mezcla: el número se muestra
  **sin colorear**, con la nota `límites no publicados` y sin bandas ni avisos.
  Nunca se inventan ni se asumen límites.
- La aceptación por resistencia **no se muestra**: es contractual y es de QC.

### Privacidad
La planta ve **solo su camión y su producción**. Ninguna pantalla lee ni muestra
identificación de losas, lote, contrato, estación ni proyecto, aunque el record los
tenga — verificado buscando esos datos en el DOM renderizado.

---

## El QR

### Contenido
Lo produce **`ConduceContract.encodeQR()`** — no se arma aquí. Es una **llave con
resumen de origen**, no una copia de los datos:

```json
{"v":2,"k":"Compañía·5002","ticket":"5002","company":"Compañía",
 "plant":"PLANTA SUR","truck":"T-02","vol":8.5,"mix":"MX-4000","batch":"14:22"}
```

Nunca lleva resultados: cuando se imprime el ticket todavía no existen.

### El codificador — decisión
**Codificador QR completo en JavaScript puro (`qr.js`, ~10 KB), no Code 128.** Code 128
es unidimensional: no aguanta un payload de ~170 caracteres ni sobrevive al polvo y los
dobleces de un ticket que viaja en la cabina.

Modo byte (UTF-8), versiones 1–40, niveles L/M/Q/H, Reed-Solomon sobre GF(256),
selección automática de versión y de máscara por penalización estándar. Salida en SVG
(nítido a cualquier DPI) o canvas.

Corrección **M**; si el contenido obligara a pasar de la versión 8, baja a **L** para que
los módulos impresos sigan siendo gruesos.

---

## Impresión

El navegador **no puede enumerar ni elegir impresoras** — lo bloquea el sistema. El
diálogo nativo de impresión ES el mecanismo, y ahí el usuario escoge la impresora que
tenga el dispositivo. La herramienta solo ajusta la **maqueta**:

| Papel | `@page` | Ancho de la hojita | QR |
|---|---|---|---|
| Automático | `margin: 6mm` | 76 mm centrada | 50 mm |
| Rollo 58 mm | `size: 58mm auto` | todo el ancho, encabezado apilado | 40 mm |
| Rollo 80 mm | `size: 80mm auto` | todo el ancho | 48 mm |
| Letter / A4 | `size: Letter portrait` | 84 mm centrada arriba, con guía de corte punteada | 54 mm |

La hojita está maquetada en `em` sobre un tamaño base, así el mismo marcado sirve para
los cuatro casos. La regla `@page` la inyecta `config.js` según lo elegido en el setup.

---

## Almacenamiento

`ConduceContract.STORE_KEY` (`qc-pr52-db-v1` en localStorage). **Solo prototipo**: se
trata como si fuera una API remota — se escribe el record de origen y se lee el estado.
En producción son dos sistemas separados hablando por API.

Del contrato v2:
- `ConduceContract.newRecord(origen, tests)` — **fábrica única** del record. e-Ticket no
  arma el objeto a mano, así ambos lados producen la misma forma y la numeración no diverge.
- `ConduceContract.ensureStore()` — arranque del almacén. e-Ticket ya no tiene rama propia
  de bootstrap.

Del contrato v3, **solo lectura**: `readMixSpec()`, `zoneAgainstSpec()`, `mixCodeOf()`.

e-Ticket escribe únicamente los `ORIGIN_FIELDS` con `source: "eticket"`. Nunca pruebas,
veredictos ni especificaciones.

---

## Verificado en navegador

- Codificador QR: **90 round-trips** contra el decodificador del sistema
  (`BarcodeDetector` de Chrome) — versiones 1 a 33, los cuatro niveles de corrección,
  payload del contrato, formato delimitado, acentos y cadenas de hasta 1 200 caracteres.
  Cero fallos.
- QR tal como sale impreso, rasterizado a resolución real: 40 mm y 48 mm a 203 dpi
  (térmica) y 54 mm a 300 dpi (láser) — decodifica en los cuatro tamaños de papel.
- Flujo completo: setup en dispositivo virgen → despacho → hojita → tablero, con la
  fábrica del contrato v2 (`n` 398, 399), contador avanzando y llave reconstruida idéntica.
- Los cuatro estados simulando lo que escribe QCheck, filtro por planta y por fecha.
- **Límites v3 contra la especificación real publicada por QCheck** (`AC300503SX`, leída
  del almacén, no un fixture): `mixCodeOf` normalizando el id completo
  `"AC300503SX - 3000 PSI @ 5 DAYS (SP-503)"`, los tres avisos (fuera de límite / en zona
  de acción / acercándose al límite), y el caso **sin publicar** — comprobado que no queda
  ni una clase de color, ni bandas, ni avisos. En tema claro y oscuro.
- Vista previa de impresión aplicando las reglas `@media print` en los cuatro papeles.
- Sin errores de consola en ninguna pantalla. Datos de prueba borrados: la base quedó
  en sus 397 records originales y sin claves `eticket-*`.

---

## Pendiente

- **Reimpresión / anulación**: se reimprime desde la lista, pero no hay anular ni corregir
  un conduce ya generado.
- **Impresora real**: la maqueta está verificada en pantalla con las reglas de impresión
  aplicadas y con el QR rasterizado a la resolución del papel, pero **falta pasarla por la
  impresora física de la caseta**.
- **Histórico**: el tablero es por día. Falta la vista de varios días / por camión.
- **Aire**: el contrato publica también los límites de aire, pero el tablero muestra solo
  revenimiento, peso unitario y temperatura (lo que Rubén definió). Añadirlo es trivial
  si la planta lo pide.
- **Aviso proactivo fuera de pantalla**: hoy el aviso de tendencia se ve al mirar el
  tablero. Si la planta quiere enterarse sin mirarlo, hace falta algún tipo de alerta
  activa — decisión de producto.
- **Camiones**: hoy es campo libre. Si conviene, pueden entrar al catálogo del setup.
