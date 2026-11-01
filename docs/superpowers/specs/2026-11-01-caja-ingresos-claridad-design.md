# Simplificación de Caja e Ingresos

Fecha: 2026-11-01. Estado: aprobado por el usuario el 2026-11-01.

## Intención y alcance acordado

El usuario eligió simplificar las dos pantallas actuales. El problema principal es interpretar caja, comisiones y alquileres de silla: un filtro puede excluir alquileres o un total puede incluir importes que no generan comisión, sin que esa diferencia resulte evidente. El resto de las funcionalidades no presentó problemas y queda fuera de esta etapa.

El objetivo es que una persona pueda responder cuánto se cobró, qué conceptos se incluyen, cuánto generó de comisión y qué parte corresponde a la barbería, sin hacer cálculos ni conocer la implementación.

## Enfoques considerados

1. **Elegido por el usuario:** conservar Caja e Ingresos y simplificar jerarquía, palabras, composición y filtros. Aprovecha las pantallas conocidas y concentra el trabajo en los errores observados.
2. Unificar las funciones en una nueva pantalla de control. Reduce navegación, pero amplía el cambio y exige aprender otra organización. Se descarta para esta etapa.

## Caja

- Encabezado con fecha completa y estado expresado como `En curso`, `Cerrada · falta contar el efectivo` o `Cerrada · efectivo contado`, según el estado real.
- Resumen principal con tres importes: **Total cobrado**, **Comisiones generadas**, **Para la barbería**. Mostrar la relación `Total cobrado − comisiones = para la barbería`, sin insinuar que las comisiones ya se pagaron o retiraron.
- Debajo de Total cobrado, composición visible de **Ventas de servicios y productos**, **Mensualidades de clientes** y **Alquileres de silla**. Los tres importes son partes del total, nunca tarjetas independientes que parezcan sumarse otra vez. Mostrar cero también cuando no haya alquileres, para que su ausencia tenga una explicación.
- Copia breve: `El alquiler de silla se suma a los cobros y no genera comisión`. No se fija ningún precio en la interfaz; se usan los importes históricos registrados.
- Bloque separado de **Efectivo en caja**, con saldo inicial, efectivo esperado y efectivo contado. Aclarar que transferencias y otros medios no son billetes en la caja, y que `Para la barbería` es antes de gastos y no equivale al efectivo físico.
- Medios de pago bajo el rótulo `Cómo se cobró`. Los movimientos pasan a llamarse `Movimientos del día`, evitando llamar venta a un alquiler.
- Mantener visibles los accesos para saldo inicial, carga de venta y conteo cuando correspondan. No se cambia su comportamiento ni el formulario de conteo en esta etapa.
- Los cobros y la composición del día usan los movimientos activos **en el cierre** (`statusAtClose`) o el estado vigente en una caja en curso. Una anulación posterior no reescribe el cierre: se muestra en una sección separada con la fecha original. La composición no usa los totales de servicios/productos que incluyen ajustes posteriores.

## Ingresos

- Mantener la navegación `Ingresos`. Reemplazar los textos `Libro de ventas`, `Tipo de venta` e `Historial de ventas` por expresiones que incluyan todos los cobros: `Ingresos del período`, `Qué querés ver` y `Movimientos`.
- Usar los mismos tres importes principales: **Total cobrado**, **Comisiones generadas**, **Para la barbería**; conservar el contador de ventas como información secundaria, aclarando que los alquileres no cuentan como ventas.
- Mostrar la misma composición de tres grupos, incluyendo en cada grupo cobrado, comisión y para la barbería. Las ventas con servicio y productos se cuentan una sola vez. Las mensualidades conservan sus propias comisiones históricas.
- Explicación breve junto a las comisiones: se suman las comisiones registradas en cada operación; servicios y productos pueden tener porcentajes distintos. El detalle existente conserva las tasas efectivamente aplicadas, sin usar el acuerdo actual para recalcular el pasado.
- Colocar los filtros y su alcance antes del resumen. Fechas y empleado son los controles principales; búsqueda, medio de pago y tipo siguen accesibles como filtros adicionales.
- Mostrar una frase de alcance siempre visible, también en móvil: fechas, empleado, conceptos, medio de pago y búsqueda aplicados. Ejemplo: `13 al 16 de octubre · Milton · Solo servicios · Todos los medios`.
- El selector conserva los tipos canónicos `Todos los ingresos`, `Servicios`, `Productos`, `Servicio + productos`, `Mensualidades` y `Alquiler de silla`. Los tipos que el contrato no permite al empleado no se ofrecen a ese rol.
- Si se selecciona un tipo que excluye alquileres, indicar `Este filtro no incluye alquileres de silla` y ofrecer `Ver todos los conceptos`, que cambia solo el tipo; mantiene fechas, empleado, búsqueda y medio de pago.
- No se modifica silenciosamente la semántica del filtro de pago: selecciona operaciones que usaron ese medio y sus totales completos, incluso si hubo pago combinado. Indicarlo cuando se aplica: `Incluye operaciones que usaron [medio]. Los importes muestran el total de esas operaciones, también si combinaron pagos`.
- Un filtro de tipo selecciona operaciones completas, no partes de una venta combinada. Mantener los comportamientos canónicos y describirlos con etiquetas explícitas.
- Durante una carga se ocultan los números anteriores. Un error restaura filtros y resultados consistentes y conserva el reintento existente; no se mezclan subtotales de consultas distintas.
- La vista del empleado mantiene sus datos autorizados de comisión: **Tu comisión**, cantidad de ventas y explicación de los filtros. No recibe ni presenta cobros globales, alquileres ni neto de la barbería.

## Datos y backend necesario

Caja ya recibe la lista completa de movimientos del día y sus importes históricos: permite derivar la composición de tres grupos y usar los totales autorizados existentes sin cambiar su consulta.

Ingresos recibe solo una página de movimientos, pero sus métricas representan el período filtrado completo. Por eso se propone una ampliación **de lectura** de `list_incomes` para añadir `metrics.composition` al resultado de managers. No se sumarán filas de la página ni se descargarán todas las páginas ni se combinarán respuestas independientes de diferentes filtros para fabricar un resumen.

Contrato propuesto: `composition` contiene exactamente `sales`, `subscriptions` y `chairRentals`; cada entrada incluye `grossTotal`, `commissionTotal` y `barbershopNet`, enteros ARS no negativos. Se agregan por `source_type` sobre las mismas operaciones filtradas y activas que las métricas, dentro de la misma consulta y antes de paginar. Las sumas de cada columna deben coincidir con la métrica general correspondiente. Se usan `incomes.total`, `commission_total` y `barbershop_net` guardados; el alquiler tiene comisión cero por el contrato existente.

Se prepara una nueva migración incremental posterior a `045`, preservando autenticación, autorización, firma RPC, filtros, pagos, anulaciones y proyección estricta del empleado. No se cambian escritores, acuerdos, tasas, precios, cierres ni datos históricos. Los tipos generados solo se actualizan si cambia la firma o el esquema que representan; no se modifican para ocultar discrepancias.

**No se ejecutará SQL remoto sin autorización explícita.** El diseño incluye preparar y verificar localmente la migración, los contratos y la interfaz. Su aplicación y la verificación contra una base autorizada son un paso separado.

Para permitir desplegar la aplicación antes de instalar la migración, el parser admite la ausencia de `composition`: muestra los totales existentes, el alcance y las explicaciones, pero omite el desglose numérico y dice `El desglose por concepto todavía no está disponible`. Nunca interpreta ausencia como cero ni presenta la página como todo el período. Con la migración instalada muestra el desglose automáticamente. La proyección del empleado no admite campos financieros administrativos nuevos.

## Ejemplo de aceptación

El caso documentado del 13 al 16 de octubre sirve como ejemplo histórico, no como consulta actual ni como datos fijos del producto:

| Concepto | Cobrado | Comisiones | Para la barbería |
| --- | ---: | ---: | ---: |
| Ventas de servicios y productos | $119.500 | $56.750 | $62.750 |
| Mensualidades | $0 | $0 | $0 |
| Alquileres de silla | $16.000 | $0 | $16.000 |
| Total | $135.500 | $56.750 | $78.750 |

Al seleccionar Servicios, se muestran $112.000 cobrados, $56.000 de comisión y $56.000 para la barbería, junto con la indicación de que el filtro excluye alquileres. Volver a todos los conceptos mantiene el resto de los filtros. Desactivar un acuerdo actual no elimina el cobro histórico de alquiler.

## Presentación y decisiones delegadas

Se conserva el sistema visual existente, con menos tarjetas al mismo nivel, palabras cotidianas y números alineados. Composición y alcance no dependen de tooltips, color ni pasar el mouse; deben poder leerse en teléfono. Se dejan al implementador los tamaños, espaciados, iconos y la composición responsive dentro de estos límites. No se agregan dependencias ni una nueva navegación.

## Fuera de alcance y límites

No se rediseña la carga de ventas, el selector de pagos, los acuerdos, los reportes, el dashboard ni los otros módulos. No se modifica la semántica financiera para que un filtro aparente conciliar. `Para la barbería` no implica utilidad después de gastos, saldo bancario, comisión pagada ni efectivo disponible. Los cierres históricos y sus ajustes mantienen su significado actual.

## Verificación e integración

Cobertura enfocada para composición con alquileres y mensualidades, ventas combinadas sin doble conteo, filtros y recuperación, período con varias páginas, pagos combinados, comisiones históricas, proyección del empleado, ausencia del campo nuevo y anulaciones posteriores al cierre. Regresión local de la migración; aceptación real de PostgreSQL solamente con autorización para una base de prueba.

Ejecutar `npm test`, `npm run lint`, `npx next typegen`, `npx tsc --noEmit`, `npm run build` y `git diff --check`. Verificar visualmente Caja e Ingresos en móvil y escritorio con datos sintéticos, sin mutar datos reales. Actualizar `context_snapshot.md` y el estado de producto cuando se complete la implementación. Preservar los cambios locales preexistentes.
