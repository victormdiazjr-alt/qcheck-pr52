# Contrato del conduce — frontera entre los dos productos

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
