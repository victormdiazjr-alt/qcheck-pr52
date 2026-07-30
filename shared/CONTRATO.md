# Contrato del conduce — interoperabilidad opcional

## Principio primero: son independientes

**Ninguna herramienta necesita a la otra.** Se venden por separado, a clientes distintos.

- **e-Ticket vende solo.** Concretec es un *posible* cliente. Su uso principal fuera de
  obra es la **venta residencial**: el camión llega a casa del cliente, el cliente escanea
  el QR con su teléfono, ve su conduce y **paga la factura ahí mismo**; recibe por correo
  el conduce y la factura listos para imprimir. Segarra no aparece por ningún lado.
- **QCheck opera solo.** Inspecciona vaciados de **muchas concreteras**, y la mayoría
  **no tendrá e-Ticket ni códigos QR**: llegan con el conduce en papel. Por eso la vía
  principal de entrada es foto/OCR y manual — el QR es el caso afortunado, no el normal.

Coinciden solo cuando la concretera con e-Ticket surte una obra que Segarra inspecciona.
Este contrato existe **para ese cruce**. Si falta, cada producto funciona completo.

## Un QR, dos públicos

El QR es una **URL con los datos en el fragmento** (`…/#v=4&tk=…&co=…`):

- El **cliente residencial** apunta la cámara → se abre la página de su conduce → paga.
- **QCheck** lee esa misma URL y saca los datos del fragmento **sin conexión**, sin abrir nada.

El fragmento nunca viaja al servidor: los datos del conduce no quedan en registros de
acceso del proveedor. Y `decodeQR` sigue aceptando el JSON de v1–v3 y el formato
delimitado de sistemas ajenos.

## Cada uno con su base

| Producto | Almacén |
|---|---|
| e-Ticket | `eticket-db-v1` |
| QCheck | `qc-pr52-db-v1` |

Ninguno lee la base del otro. El traspaso ocurre por el QR (o, más adelante, por API).

---

# Detalle del contrato

**e-Ticket** (concretera) y **QCheck** (Segarra QC) son **productos independientes,
para clientes distintos**. No comparten código de producto. Comparten **solo este contrato**.

```
   e-Ticket                  shared/conduce-contract.js                  QCheck
   (concretera)      ───────▶   llave · campos de origen   ◀───────   (Segarra QC)
   crea el conduce              formato del QR                        lo enriquece
```

## Reglas

1. **Llave primaria = compañía + número de conduce.** Los tickets se repiten entre plantas.
2. **e-Ticket solo escribe los campos de origen** (`ORIGIN_FIELDS`): ticket, company, plant,
   truck, vol, mix, batch. Pruebas, veredicto, cilindros y tiempos de obra son de QCheck.
3. **El QR es una llave, no una copia.** Se genera siempre con `encodeQR()`. Lleva el
   identificador más un resumen mínimo del origen, para operar sin señal.
   Nunca lleva resultados: no existen cuando se imprime el ticket.
4. **Nadie cambia este contrato por su cuenta.** Si hace falta un campo nuevo, se pide a la
   sesión principal, que sube `VERSION` y avisa a ambos lados.

## Por qué no comparten `core.js`

Son negocios distintos que van a divergir: la planta querrá dosificación, flota y despacho;
QC querrá cartas de control y cumplimiento. Si comparten el motor, cada cambio de un cliente
arriesga romper al otro y las dos sesiones chocan en los mismos archivos. Compartiendo solo
el contrato, cada producto evoluciona libre y la integración queda explícita y verificable.

## Runtime compartido — solo en el prototipo

Hoy ambos leen y escriben la misma base local (`STORE_KEY`) para que la demo funcione de
punta a punta en una máquina: se genera el ticket en una ventana y aparece en QCheck en la
otra. **En producción son sistemas separados que hablan por API**; cambia la capa de
transporte y esta constante, nada más.
