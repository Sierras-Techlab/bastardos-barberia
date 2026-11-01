# Auditoría de comisiones de Milton — 16/10/2026

La base configurada en `.env` se consultó exclusivamente con `select` y la función estable `list_incomes` (lectura). No se modificaron datos ni acuerdos. Usuario encontrado: Milton Delich, empleado. Configuración actual: comisión de servicios 50%, de productos 10%, ambas habilitadas; alquiler de silla actualmente deshabilitado.

## Reproducción del 13 al 16 de octubre

Se llamó a `list_incomes` como administrador con Milton y el mismo rango de fechas, cambiando únicamente el filtro `kind`. La suma directa de `incomes` e `income_items` confirmó los importes:

| Filtro | Facturación | Comisión | Detalle |
| --- | ---: | ---: | --- |
| Servicio | $112.000 | $56.000 | 7 ventas; exactamente 50% |
| Productos | $7.500 | $750 | 1 venta; exactamente 10% |
| Alquiler de silla | $16.000 | $0 | 1 cobro del 13/10 |
| Todos | $135.500 | $56.750 | Suma de las tres categorías |

Si se aplica 50% indiscriminadamente a la facturación de “Todos”, se esperaría $67.750. Los $11.000 de diferencia se explican por $8.000 que serían la mitad del alquiler (no es una venta comisionable) y $3.000 de aplicar 50% en vez del 10% configurado al producto. La comisión por ventas sí concilia: $56.000 + $750 = $56.750. Las ocho ventas activas del período tienen comisiones de sus renglones que suman exactamente el total guardado. No hay evidencia de comisión perdida en la suma.

## Por qué aparece el alquiler

El historial de acuerdos muestra que el 13/10 se habilitó un alquiler mensual de silla de $16.000, con vigencia desde agosto. Ese mismo día se confirmó un pago de $16.000 correspondiente a octubre. El 15/10 se deshabilitó el alquiler en el acuerdo actual. El pago de octubre sigue activo y figura como ingreso histórico con `source_type = chair_rental`, total $16.000 y comisión $0.

La consulta administrativa con `kind = null` incluye alquileres en facturación y medios de pago; los filtros `service` y `products` los excluyen. La vista del propio empleado excluye alquileres. Por eso la comparación visual de “Facturación bruta” con “Comisiones” en la vista administrativa parece menor al 50% al elegir “Todos”. La pantalla muestra correctamente lo guardado, aunque mezcla en ese resumen ingresos por ventas e ingresos por alquiler de silla, que tienen reglas distintas.

## Alcance

El usuario no indicó un rango exacto para el cierre; el 13–16/10 reproduce el síntoma con los movimientos más recientes. En otros períodos pueden intervenir ventas combinadas y tasas históricas del 100% para servicios. Para cualquier liquidación hay que sumar la comisión efectivamente devengada por cada renglón; la tasa actual de 50% no reescribe ventas anteriores.
