# e-Ticket — herramienta de la concretera

Genera el conduce con código QR cuando se carga el camión, imprime el ticket que se
lleva el chofer, le muestra a la planta su producción, y **le da al cliente una página
propia donde ve su entrega y paga su factura desde el teléfono**.

## Producto independiente

e-Ticket **se vende solo**. No necesita a QCheck ni a ningún otro sistema:

- Base de datos **propia** (`eticket-db-v1`). Nunca escribe en la de nadie más.
- Tendrá **su propio backend y su propio dominio**. Ningún archivo asume que otro
  producto viva en el mismo servidor.
- `../shared/conduce-contract.js` es **opcional**: es el idioma común para cuando un
  inspector con QCheck coincide en la misma obra. **Si falta, `conduce-min.js` provee lo
  mínimo y la herramienta funciona completa** — genera conduces, imprime, cobra y muestra
  producción. Lo único que se pierde es el traspaso automático al inspector.
  *(Verificado: se retiró el archivo del servidor y las cuatro pantallas siguieron
  funcionando idénticas, mismo formato de QR incluido.)*

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

## Archivos

| Archivo | Qué es |
|---|---|
| `setup.html` + `setup.js` | configuración (compañía, plantas, mezclas, numeración, **URL pública**, **facturación**, papel) |
| `index.html` + `eticket.js` | **Despacho / Carga** — cargar camión, generar ticket, hojita, tickets de hoy |
| `produccion.html` + `produccion.js` | **Tablero de producción** |
| `c/index.html` + `c/cliente.js` + `c/cliente.css` | **Página pública del conduce** — la que abre el cliente |
| `datos.js` | **capa de datos: único punto que toca el almacenamiento** |
| `config.js` | configuración del producto y fórmula de la factura |
| `conduce-min.js` | respaldo mínimo del contrato, para funcionar sin él |
| `qr.js` | codificador QR propio, JavaScript puro |
| `eticket.css` | estilos de las pantallas de planta y maqueta de impresión |

### Dónde tocar cuando llegue el backend
**Solo `datos.js`.** Todas las pantallas de planta piden los datos a `EtDatos`; ninguna
lee ni escribe almacenamiento por su cuenta. Cambiar localStorage por `fetch` no toca
ninguna pantalla. La página del cliente ni siquiera usa almacenamiento: vive de la URL.

---

## El QR: una llave, dos públicos

El contrato (o el respaldo) produce **una URL** con el resumen del conduce en el
fragmento `#`, y e-Ticket le añade fecha y tarifas:

```
https://conduce.suempresa.com/c/#v=4&k=Compañía·90001&tk=90001&co=…&tr=141&cy=9
   &mx=HR-3000&bt=14:57&dt=2026-07-30&pr=145&tf=75&tx=11.5&ex=40&xl=Espera
```

- **El cliente** apunta la cámara y se le abre su conduce, con su factura.
- **Un inspector con QCheck** lee la misma URL y saca los datos del fragmento, sin
  conexión, sin abrir nada.
- El fragmento **nunca viaja al servidor**: el detalle del conduce no queda en registros
  de acceso ni en el historial del proveedor de alojamiento.

La **URL pública base** se configura en el setup y es la dirección propia de e-Ticket,
no donde esté alojada la herramienta hoy. Sin ella el QR sigue sirviendo para importar
el conduce, pero no hay página que abrir.

### El codificador
`qr.js`, ~10 KB, JavaScript puro, sin CDN. Modo byte (UTF-8), versiones 1–40, niveles
L/M/Q/H, Reed-Solomon sobre GF(256), selección automática de versión y máscara. Salida
SVG (nítida a cualquier DPI) o canvas. Corrección M; pasa a L si el contenido obliga a
más de la versión 8, para que los módulos impresos sigan gruesos.

---

## Página pública del cliente (`/c/`)

Móvil primero, **autónoma**: no carga el contrato, no usa almacenamiento, no conoce la
planta. Todo lo que muestra viene de la URL, porque el teléfono del cliente nunca ha
visto la base de la concretera.

- **Su entrega** en lenguaje de cliente: volumen en yd³, tipo de mezcla, camión, de qué
  planta salió, fecha y hora. Nada de jerga ni de datos internos.
- **Su factura**: hormigón (yd³ × precio) + viaje + cargos del conduce, subtotal,
  impuesto y total.
- **Descargar o imprimir**: hoja con el conduce y la factura.
- Si el enlace viene incompleto, lo dice en claro y le dice qué hacer.

### Pago — estado real

**No hay procesador de pagos conectado, y es deliberado.** La página presenta los tres
métodos que Víctor quiere ofrecer y llega hasta el punto exacto de redirección:

| Método | Qué hace falta para activarlo |
|---|---|
| **PayPal** | cuenta de comercio + credenciales (client id/secret) del lado del servidor |
| **Apple Pay** | Merchant ID, certificado de comercio, **dominio verificado ante Apple**, HTTPS y validación de sesión desde el backend |
| **ATH Móvil** | cuenta de comercio EVERTEC y su API key de negocio, también del servidor |

Reglas que cumple la página:

- **Nunca pide número de tarjeta, CVV, ni credenciales de ninguna cuenta.**
  No hay un solo formulario de pago: el único campo de toda la página es el correo.
- **Apple Pay solo aparece si el dispositivo lo soporta** (`ApplePaySession.canMakePayments`).
  No se ofrece una opción que no puede funcionar.
- Al pulsar un método sale una confirmación honesta —*"Aquí se le llevaría a PayPal para
  completar el pago de $1,583.30"*— que dice explícitamente que **no se ha hecho ningún
  cargo**. Un aviso fijo de **demostración** está siempre visible arriba.
- **Un solo punto de integración**: `iniciarPago(metodo, factura)` en `c/cliente.js`, con
  el `fetch` de ejemplo comentado encima. Es lo único que cambia cuando se escoja proveedor.

> **Iconos de los métodos de pago:** son **dibujos propios y sobrios**, no los logotipos
> oficiales. PayPal, Apple Pay y ATH Móvil tienen guías de marca y recursos autorizados;
> **para producción hay que sustituirlos por los botones oficiales de cada marca**, que
> además suelen ser obligatorios por contrato.

### Envío por correo
`enviarPorCorreo(email, factura)` es el otro punto de integración. Enviar de verdad
necesita un servicio de correo con dominio verificado y credenciales del servidor —
desde el navegador no se puede ni se debe. Mientras tanto el cliente descarga o imprime.

---

## Despacho

Conduce (del contador de la configuración), camión, planta, mezcla, volumen con steppers,
hora de cargado con botón **AHORA**, y **cargos adicionales de este conduce** (aparecen
solo si hay facturación configurada). Al generar: valida, rechaza duplicados por llave
(compañía + conduce), crea el record, abre la hojita y avanza el contador.

La lista del día muestra los tickets con su estado. El enriquecimiento de obra (llegada,
pruebas, veredicto) solo aparece si llega por integración; e-Ticket nunca lo calcula.

### Impresión
El navegador no puede elegir impresoras — eso es del diálogo del sistema. La herramienta
ajusta la **maqueta**: Automático, rollo 58 mm, rollo 80 mm y Letter/A4 (ticket centrado
arriba con guía de corte). La hojita está maquetada en `em`, así el mismo marcado sirve
para los cuatro.

---

## Tablero de producción

Camiones despachados, volumen, en ruta, ritmo (CY/h y cargas/h), intervalo entre cargas,
tiempos de ciclo (planta→obra, espera, descarga, ciclo completo y el peor del día), y la
tabla de camiones del día filtrable por planta y fecha.

**Calidad devuelta por el laboratorio:** e-Ticket no lee la base de otro producto. Esa
información llegará por API cuando exista el backend. Mientras tanto la sección se muestra
**vacía y diciendo por qué** — no se esconde ni se inventa. El código que la pinta ya está
listo (valores, σ, tendencia, y coloreado contra límites publicados por un laboratorio):
se enciende solo en cuanto lleguen los datos.

**Privacidad:** la planta ve solo su camión y su producción. Ninguna pantalla lee ni
muestra identificación de losas, lote, contrato ni proyecto.

---

## Verificado en navegador

- **Modo autónomo real**: se retiró `shared/` del servidor y se comprobó que despacho,
  producción, setup y página del cliente funcionan igual, con el mismo formato de QR y sin
  un solo error de consola (solo el aviso informativo deliberado).
- **Base propia**: los conduces se crean en `eticket-db-v1` con numeración propia desde 1;
  la base de QCheck quedó intacta en sus 397 records, con 0 escrituras de e-Ticket.
- **QR → teléfono del cliente**: se generó un ticket, se decodificó su QR con el
  decodificador del sistema (Chrome `BarcodeDetector`) → URL idéntica, y se abrió esa URL
  **en una ventana limpia con viewport de móvil**, como el cliente.
- **Factura**: 9 yd³ × $145 + $75 viaje + $40 cargo = $1,420 + 11.5 % = **$1,583.30**,
  cuadrado contra el cálculo.
- **Pago**: los tres métodos, la confirmación honesta de cada uno, y `cobrado: false`.
  Apple Pay oculto cuando el dispositivo no lo soporta y visible cuando sí.
  Auditado el DOM: **0 formularios, 0 inputs que no sean el correo**, ningún
  `autocomplete` de tarjeta.
- Estado de error con enlace incompleto, validación del correo, y hoja imprimible.
- Codificador QR: 90 round-trips previos (versiones 1–33, cuatro niveles de corrección) y
  decodificación a resolución real de impresión en los cuatro papeles.
- Datos de prueba borrados: sin claves `eticket-*`, base de QCheck intacta.

---

## Pendiente

- **Procesador de pagos** — decisión de negocio de Víctor. Ver la tabla de arriba.
- **Botones oficiales de PayPal / Apple Pay / ATH Móvil**, con los recursos de cada marca.
- **Servicio de correo** para enviar conduce y factura.
- **Backend propio de e-Ticket**: al llegar, se reescribe `datos.js` y nada más.
- **Impresora real** de la caseta: la maqueta está verificada en pantalla y el QR a
  resolución de impresión, pero falta pasarla por la impresora física.
- **Anulación / corrección** de un conduce ya generado.
- **Histórico** en el tablero: hoy es por día; falta la vista de varios días.
