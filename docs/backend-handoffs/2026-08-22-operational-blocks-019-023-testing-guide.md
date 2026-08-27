# Guía de instalación y prueba de los bloques 019 a 023

Esta guía está pensada para probar los cambios operativos en la base de datos y en la aplicación de test. No debe usarse sobre producción.

## Antes de comenzar

1. Confirmar que la base de test tiene instaladas correctamente las migraciones `001` a `018`.
2. Actualizar la rama compartida y confirmar que contiene el código de los bloques que se van a probar.
3. Verificar que exista el archivo SQL correspondiente antes de comenzar cada bloque:
   - `supabase/queries/019_employee_work_sessions.sql`
   - `supabase/queries/020_income_pricing_owner_commissions_and_employee_privacy.sql`
   - `supabase/queries/021_fixed_customer_monthly_payments.sql`
   - `supabase/queries/022_manual_cash_lifecycle.sql`
   - `supabase/queries/023_customer_last_visit.sql`
4. Ejecutar los archivos completos desde el SQL Editor de Supabase, de a uno y en ese orden.
5. Si una migración devuelve un error, no ejecutar la siguiente. Guardar el mensaje completo y resolver primero la migración que falló.

Cada archivo está diseñado para ejecutarse dentro de una transacción y recargar el esquema de PostgREST. No copiar solamente fragmentos del archivo.

### Importante sobre las pruebas por bloque

La rama puede contener código de un bloque posterior al último instalado en la base. Por ejemplo, el código de 020 espera una proyección de ingresos que no existe después de instalar solamente 019. En ese estado puede aparecer un error aunque 019 esté correctamente instalado.

El procedimiento recomendado es:

1. Ejecutar cada SQL individualmente y realizar su verificación técnica.
2. Llevar la base hasta la misma migración que el código de la rama.
3. Con código y base alineados, realizar las pruebas funcionales de cada sección de esta guía.

No modificar el código para intentar corregir errores `PGRST202` o errores de validación mientras la base esté atrasada.

## Datos mínimos recomendados

Preparar en la base de test:

- Un usuario owner activo.
- Un usuario admin activo.
- Dos usuarios employee activos, para comprobar la separación de jornadas y clientes fijos.
- Un servicio activo con precio fácil de calcular, por ejemplo ARS 20.000.
- Un producto activo con stock y precio fácil de calcular, por ejemplo ARS 10.000.
- Los medios de pago `Efectivo` y `Transferencia` o `QR`.
- Dos o tres clientes de prueba.

Para facilitar los cálculos se pueden usar estas comisiones:

- Employee A: 50% en servicios y 20% en productos.
- Employee B: 30% en servicios y 10% en productos.
- Owner: comenzar en 0% y luego cambiar servicios a 25% desde Usuarios.

## Bloque 019 — Presentismo y jornadas de empleados

### Instalar

Ejecutar completo:

`supabase/queries/019_employee_work_sessions.sql`

Verificación rápida en el SQL Editor:

```sql
select
  to_regclass('public.employee_work_sessions') as jornadas,
  to_regclass('public.employee_work_session_corrections') as correcciones,
  to_regprocedure('public.get_current_work_session(uuid)') as jornada_actual,
  to_regprocedure('public.start_work_session(uuid)') as marcar_entrada,
  to_regprocedure('public.end_work_session(uuid)') as marcar_salida;
```

Ninguna de las cinco columnas debe devolver `null`.

### Probar como employee

- [ ] Iniciar sesión sin recibir errores de jornadas ni `PGRST202`.
- [ ] Sin una jornada abierta, entrar en `Ingresos > Nueva venta`. La aplicación debe bloquear la carga y ofrecer ir a Presentismo.
- [ ] Presionar `Marcar entrada`. Debe quedar visible una jornada abierta y el tiempo transcurrido.
- [ ] Intentar iniciar otra jornada. No debe crearse una segunda jornada abierta.
- [ ] Con la jornada abierta, registrar una venta normal.
- [ ] Presionar `Marcar salida` y comprobar que la jornada quede cerrada.
- [ ] Volver a iniciar y finalizar otra jornada el mismo día. Deben permitirse varias jornadas cerradas, pero sólo una abierta.
- [ ] En el historial propio sólo deben aparecer tiempo trabajado, cantidad de ventas e ingreso/comisión del empleado. No deben aparecer bruto ni neto de la barbería.

### Probar como owner o admin

- [ ] Ingresar a Presentismo y filtrar por empleado.
- [ ] Confirmar que la venta realizada aparece vinculada a la jornada correcta.
- [ ] Verificar por jornada el bruto generado, la comisión del empleado y el neto de la barbería.
- [ ] Corregir manualmente una entrada o salida indicando un motivo obligatorio.
- [ ] Confirmar que owner y admin pueden registrar ventas propias sin abrir una jornada.
- [ ] Registrar para un employee que no tenga jornada abierta. La venta debe admitirse y quedar auditada como realizada fuera de jornada.

Resultado esperado principal: un employee no puede registrar su propia venta sin marcar entrada, y nunca recibe métricas financieras reservadas al manager.

## Bloque 020 — Precios cobrados, comisión del owner y privacidad del employee

### Instalar

Ejecutar completo, después de 019:

`supabase/queries/020_income_pricing_owner_commissions_and_employee_privacy.sql`

Verificación rápida:

```sql
select
  to_regprocedure('public.income_as_employee_json(uuid)') as ingreso_employee,
  to_regprocedure(
    'public.list_incomes(uuid,boolean,uuid,date,date,uuid,text,text,text,integer,integer)'
  ) as listar_ingresos;
```

Ambas columnas deben devolver el nombre de la función.

### Probar comisión configurable del owner

- [ ] Desde `Usuarios`, editar el owner y cambiar su comisión de servicio de 0% a 25%.
- [ ] Registrar una venta de ARS 20.000 atribuida al owner.
- [ ] Confirmar una comisión de ARS 5.000 y un neto de barbería de ARS 15.000.
- [ ] Confirmar que una comisión configurada en 0% sigue dejando el total completo como neto de la barbería.

### Probar cambio de precio como owner o admin

- [ ] Seleccionar el servicio de ARS 20.000 para el Employee A, cuya comisión es 50%.
- [ ] Cambiar el precio cobrado a ARS 10.000 e indicar el motivo del descuento.
- [ ] Antes de confirmar, comprobar: precio de lista ARS 20.000, cobrado ARS 10.000, ajuste/descuento ARS 10.000, comisión ARS 5.000 y neto ARS 5.000.
- [ ] Confirmar la venta y revisar que esos valores permanezcan en el detalle y el libro de ingresos.
- [ ] Probar también un precio en cero. Debe permitir una venta gratuita sin medios de pago, conservando el motivo y el valor de lista para auditoría.
- [ ] Intentar modificar un precio sin motivo. La operación debe bloquearse.

### Probar como employee

El employee debe tener una jornada abierta por las reglas de 019.

- [ ] Entrar a Nueva venta y confirmar que no se muestre el precio de lista, el total bruto ni el neto de la barbería.
- [ ] Para el servicio de ARS 20.000 con comisión de 50%, comprobar que vea solamente su ingreso de ARS 10.000.
- [ ] El employee no debe poder modificar precios ni conceder descuentos.
- [ ] En un pago combinado debe distribuir porcentajes que sumen 100%, no importes en pesos.
- [ ] Probar, por ejemplo, 50% Efectivo y 50% Transferencia.
- [ ] En Inicio, libro de ingresos y detalle debe ver sólo sus conceptos y su ingreso/comisión.
- [ ] No deben aparecer pagos en pesos, precio de lista, precio cobrado, descuentos, total de la venta, registrante ni neto de barbería.

Como verificación adicional, abrir las herramientas de desarrollo del navegador y revisar las respuestas de `/api/incomes`: para employee tampoco deben existir campos como `payments`, `total`, `grossTotal`, `barbershopNet`, `catalogUnitPrice` o `chargedUnitPrice`.

## Bloque 021 — Clientes fijos, profesional responsable y pago mensual

### Instalar

Antes de ejecutar 021, revisar el bloque de prevalidación indicado para esta migración en `supabase/queries/README.md`. Las agendas fijas antiguas pueden no tener profesional ni precio mensual y no deben asignarse automáticamente.

Ejecutar completo, después de 020:

`supabase/queries/021_fixed_customer_monthly_payments.sql`

Si aparece `LEGACY_FIXED_SCHEDULE_MAPPING_REQUIRED`, detenerse y resolver los clientes informados siguiendo el README. No inventar profesionales o importes desde SQL.

Verificación rápida (debe devolver dos filas):

```sql
select p.oid::regprocedure as funcion
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('list_fixed_customer_months', 'pay_fixed_customer_month')
order by p.proname;
```

### Probar configuración y separación por profesional

- [ ] Como owner/admin, crear o editar un cliente habitual indicando día, hora, profesional responsable y precio mensual.
- [ ] Asignar un cliente al Employee A y otro al Employee B.
- [ ] Iniciar sesión como Employee A: debe ver únicamente sus propios clientes fijos y no los del Employee B.
- [ ] Como employee, crear o modificar un cliente fijo. El profesional debe quedar forzado al propio employee.
- [ ] Como manager, cambiar el profesional responsable. Los meses pendientes futuros deben usar el nuevo profesional; los pagos ya realizados no deben cambiar.

### Probar pago mensual

- [ ] Confirmar que el período figure inicialmente como `Pendiente`.
- [ ] Marcarlo como pagado desde Clientes o Inicio.
- [ ] Como manager, cargar importes exactos por medio de pago; como employee, cargar porcentajes que sumen 100%.
- [ ] Confirmar que se cree un ingreso real de tipo mensualidad y que figure en el libro de ingresos y en Caja.
- [ ] Confirmar que la comisión use el porcentaje de servicio vigente del profesional al momento de pagar.
- [ ] Para una mensualidad de ARS 20.000 y comisión de 50%, el employee debe recibir ARS 10.000 y la barbería ARS 10.000.
- [ ] Verificar que pagar una mensualidad no incremente la cantidad de visitas ni la última visita del cliente.
- [ ] Intentar pagar dos veces el mismo mes. No debe duplicarse el ingreso.
- [ ] Anular el ingreso de mensualidad como manager. El período debe volver a `Pendiente` sin borrar el intento anterior.
- [ ] Como employee sin jornada abierta, intentar cobrar una mensualidad. Debe solicitar marcar entrada.

## Bloque 022 — Apertura, cierre y conciliación manual de Caja

### Instalar

Antes de ejecutar 022 debe existir exactamente un medio de pago válido llamado `Efectivo`. La migración lo protege como el medio que representa dinero físico.

Ejecutar completo, después de 021:

`supabase/queries/022_manual_cash_lifecycle.sql`

Si aparece `CASH_PAYMENT_METHOD_REQUIRED`, detenerse y corregir el catálogo de medios de pago antes de volver a ejecutar la migración.

Verificación rápida (debe devolver las cuatro funciones):

```sql
select p.oid::regprocedure as funcion
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in (
    'open_daily_cash',
    'close_daily_cash',
    'confirm_daily_cash',
    'close_pending_daily_cash'
  )
order by p.proname;
```

### Probar apertura

- [ ] Como owner/admin, abrir manualmente la caja en ARS 0.
- [ ] Otro día de prueba, abrirla con ARS 10.000 de saldo inicial para cambio.
- [ ] Confirmar que esos ARS 10.000 no se sumen a ventas, ingresos, comisiones ni facturación.
- [ ] Confirmar que sí formen parte del efectivo físico esperado.
- [ ] Probar `Abrir y cargar ingreso`: primero debe abrir la caja y luego llevar a Nueva venta.
- [ ] En una caja todavía no abierta, registrar directamente la primera venta. Debe abrirse automáticamente en ARS 0.
- [ ] Intentar abrir dos veces el mismo día. No debe cambiarse el saldo inicial ya registrado.

### Probar efectivo y otros medios

- [ ] Registrar una venta dividida entre Efectivo y Transferencia.
- [ ] Confirmar que solamente la parte en Efectivo aumente el dinero físico esperado.
- [ ] Transferencia, QR u otros medios deben aparecer en ventas, pero no en el efectivo esperado de la caja.
- [ ] Confirmar que el saldo inicial se muestre separado del desglose de ventas.

### Probar cierre

- [ ] Cerrar manualmente indicando el efectivo contado.
- [ ] Si contado y esperado coinciden, la diferencia debe ser ARS 0 y el cierre debe quedar confirmado.
- [ ] Probar un sobrante y un faltante. La diferencia debe mostrarse con el signo correcto.
- [ ] Confirmar que después del cierre no se recalculen ni cambien los totales financieros congelados.
- [ ] Para probar el cierre automático sin esperar al día siguiente, usar el escenario transaccional documentado para 022 en `supabase/queries/README.md`.
- [ ] Un cierre automático debe quedar `Pendiente de confirmación`.
- [ ] Como owner/admin, cargar después el efectivo contado y confirmar. Esa confirmación sólo agrega contado y diferencia; no modifica ventas ni pagos históricos.
- [ ] Confirmar que un employee no pueda abrir, cerrar, confirmar ni consultar Caja.

## Bloque 023 — Última visita del cliente

### Instalar

Ejecutar completo, después de 022:

`supabase/queries/023_customer_last_visit.sql`

Verificación rápida:

```sql
select to_regprocedure('public.list_customers(uuid)') as listar_clientes;
```

La columna debe devolver el nombre de la función.

### Probar desde Clientes

- [ ] Crear un cliente sin ventas. Debe mostrar `Sin visitas`.
- [ ] Registrar una venta normal con ese cliente. Debe mostrar la fecha y `hoy` o la antigüedad correspondiente.
- [ ] Registrar posteriormente otra venta normal. Debe mostrarse la más reciente.
- [ ] Anular la última venta. La última visita debe volver a la venta activa anterior.
- [ ] Si se anulan todas las ventas normales, debe volver a `Sin visitas`.
- [ ] Marcar asistencia en la agenda semanal sin crear una venta. No debe cambiar la última visita.
- [ ] Pagar una mensualidad del bloque 021. No debe cambiar la última visita ni sumar una visita.
- [ ] Confirmar que la información aparezca tanto en la tabla de escritorio como en las tarjetas móviles.

Resultado esperado principal: la última visita deriva exclusivamente de ventas normales activas asociadas al cliente, no de asistencia, mensualidades ni valores guardados manualmente.

## Comprobación cruzada final

Cuando las cinco migraciones estén instaladas y la aplicación use el mismo código de la rama:

- [ ] Owner y admin pueden iniciar sesión y usar todos los módulos administrativos.
- [ ] Employee puede iniciar sesión sin errores de RPC o validación.
- [ ] Employee debe marcar entrada antes de registrar ventas o cobrar mensualidades.
- [ ] Employee sólo ve lo que gana; nunca el bruto ni el neto de la barbería.
- [ ] Owner tiene comisiones configurables para ventas futuras.
- [ ] Descuentos, recargos y ventas gratuitas conservan valor de lista, valor cobrado y motivo para managers.
- [ ] Los clientes fijos están separados por profesional y sus mensualidades pagadas crean ingresos reales.
- [ ] El saldo inicial de Caja afecta solamente el efectivo esperado y nunca las ventas.
- [ ] La última visita cambia por ventas normales activas, no por mensualidades o asistencia.
- [ ] No aparecen errores en la consola del servidor ni del navegador durante las pruebas.

## Errores frecuentes

### `PGRST202`

La aplicación está llamando una función que no existe con esa firma en la base o todavía no fue recargada en el esquema de PostgREST. Confirmar que se ejecutó la migración correcta y usar las consultas `to_regprocedure` de esta guía.

### `Database operation failed: validate ... (unknown)`

Generalmente significa que la función existe pero devuelve la estructura de una migración anterior. Confirmar que la base llegó al mismo bloque que el código de la rama.

### La migración falla a mitad de ejecución

Los archivos usan transacciones. Revisar el error completo, resolver su precondición y volver a ejecutar el archivo completo. No continuar con el bloque siguiente y no aplicar manualmente sólo la sentencia que falló.

### La interfaz conserva un error después de instalar

Esperar unos segundos por la recarga de PostgREST, cerrar sesión, recargar la aplicación y volver a ingresar. Si continúa, guardar el error completo, el bloque instalado y el resultado de las consultas de verificación.

## Registro de la prueba

Para cada bloque conviene anotar:

- Fecha y persona que ejecutó la migración.
- Nombre del archivo ejecutado.
- Resultado de la verificación técnica.
- Roles utilizados en la prueba.
- Casos aprobados y casos fallidos.
- Mensaje completo de cualquier error.
- Capturas de los valores financieros importantes.

No marcar un bloque como validado en base de test solamente porque el SQL terminó sin errores: también deben completarse sus pruebas funcionales.
