# Role-aware incomes view design

## Objetivo

Adaptar `/incomes` al contrato V2 de ingresos, pagos combinados y comisiones, conservando sus presentaciones de escritorio y móvil. La información, los filtros y las métricas deben responder al rol autenticado sin depender de ocultamiento visual como mecanismo de autorización.

## Alcance

- Mantener tabla de escritorio y tarjetas móviles.
- Mostrar empleado responsable, pagos y comisión en ambas presentaciones.
- Ampliar el detalle con usuario registrador, distribución de pagos y snapshot de comisión.
- Adaptar métricas y filtro de empleado según rol.
- Mantener estados de carga, error, vacío, paginación y anulación.
- Preparar estados explícitos para respuestas legacy mientras el backend V2 esté pendiente.

No se modifican Route Handlers, repositorios, servicios, SQL ni Supabase en esta tarea frontend.

## Experiencia por rol

### Employee

- El backend entrega únicamente ventas cuyo `employee.id` coincide con el usuario autenticado.
- El frontend no renderiza el filtro de empleado y nunca agrega `userId` manipulable a las consultas originadas por sus filtros.
- Métricas: total vendido, comisión acumulada, cantidad de ventas y promedio por venta.
- No se muestra el neto de la barbería ni controles de anulación.
- Tabla, tarjetas y detalle muestran únicamente información operativa necesaria sobre sus ventas.

### Owner y admin

- El backend permite visión global.
- El filtro de empleado ofrece `Todos` y cada usuario elegible.
- Al seleccionar un empleado, resultados, métricas y paginación se solicitan nuevamente con su `userId`.
- Métricas: facturación bruta, comisiones devengadas, neto de barbería y cantidad de ventas.
- Pueden ver responsable y registrador, además de conservar la anulación existente.

## Modelo de presentación V2

Cada ingreso puede incluir:

- `employee`: responsable de realizar la venta.
- `registeredBy`: usuario que la cargó.
- `payments`: uno o dos registros de efectivo/transferencia.
- `commission`: snapshot de bases, porcentajes e importes de servicio y productos, total devengado, neto de barbería y excepción de servicio al 100%.

Los campos V2 serán opcionales en el adaptador visual durante la transición. Una respuesta legacy muestra `Pendiente de backend` en datos económicos que no pueden reconstruirse con certeza; nunca inventa una comisión cero.

## Componentes

- `IncomesView` conserva estado, refetch, paginación y selección, y construye consultas seguras según rol.
- `IncomeFilters` recibe capacidad explícita para filtrar empleados; no decide autorización por sí solo.
- `IncomeMetrics` recibe rol y métricas V2 para construir cuatro tarjetas diferentes por audiencia.
- `IncomeTable` muestra responsable, pago, total y comisión; datos administrativos adicionales quedan en el detalle para evitar saturación.
- `IncomeMobileList` presenta el mismo significado en formato compacto.
- `IncomeDetailSheet` muestra pagos desglosados, responsable, registrador y snapshot de comisión. En anulados conserva el historial y marca los importes como excluidos de métricas.

## Flujo y seguridad

1. La página autentica al usuario y obtiene un resultado ya limitado por el servidor.
2. `IncomesView` recibe `canViewAll` y la identidad autenticada.
3. Para employee, cualquier `userId` inicial se elimina y las consultas de filtro nunca lo incorporan.
4. Para manager, `userId` vacío significa todos y un UUID significa el empleado seleccionado.
5. El servidor debe volver a aplicar autorización y alcance; la UI no es una frontera de seguridad.

## Estados y errores

- Durante refetch se conserva el resultado visible con opacidad reducida.
- Un error no borra los últimos datos válidos.
- Sin resultados se conserva la acción de limpiar filtros.
- Si faltan campos V2, se muestra `Pendiente de backend`.
- Las ventas anuladas conservan snapshots, pero no aportan a las métricas activas.

## Pruebas

- Employee no ve filtro, no envía `userId`, recibe métricas personales y no ve neto de barbería.
- Owner/admin ve `Todos`, puede filtrar y el resultado completo se reemplaza con métricas del empleado.
- Tabla y móvil identifican pago combinado y comisión.
- Detalle distingue responsable/registrador y desglosa pagos/comisión.
- Legacy muestra estados pendientes sin fabricar valores.
- Anulados quedan excluidos visualmente y no alteran el flujo de anulación existente.

