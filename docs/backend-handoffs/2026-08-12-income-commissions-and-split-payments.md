# Handoff backend: empleado responsable, pagos combinados y comisiones

El frontend de la rama `feat/27-income-commissions` ya modela el contrato V2. No se modificó ningún Route Handler, repositorio, servicio, SQL ni proyecto Supabase. Hasta integrar este contrato, el formulario nuevo puede recibir un error del backend actual y debe considerarse intencional.

## Cambios persistentes recomendados

Agregar una migración aditiva `010_income_commissions_and_split_payments.sql`:

- `users.service_commission_rate integer not null default 0 check (between 0 and 100)`.
- `users.product_commission_rate integer not null default 0 check (between 0 and 100)`.
- En `incomes`, separar `registered_by` (usuario autenticado) de `employee_id` (responsable de la venta).
- Guardar snapshots inmutables: bases, porcentajes, importes de comisión por servicio/productos, comisión total, neto de barbería y bandera `full_service_commission`.
- Si se autoriza el 100%, guardar también `full_service_commission_authorized_by`.
- Crear `income_payments` con `income_id`, `method` (`cash` o `transfer`) y `amount`; la suma debe coincidir exactamente con el total de la venta dentro de la misma transacción.
- Conservar las instantáneas al anular. Las ventas anuladas aportan cero a métricas activas.
- Migrar ventas anteriores: `employee_id = registered_by`, un pago desde `payment_method` por el total, y comisiones `0` marcadas como datos históricos migrados.

Aplicar una migración en Supabase cambia la base compartida: cambiar de rama Git no la revierte. Preparar primero rollback o una migración inversa y ejecutar SQL manualmente solo después de revisar.

## Autorización y cálculo

- `employee`: el backend ignora/rechaza otro `employeeId` y usa el usuario autenticado.
- `owner` y `admin`: pueden asignar cualquier usuario activo.
- `registered_by` siempre sale de la sesión, nunca del JSON.
- El servidor obtiene precios y porcentajes vigentes de la base. El navegador no puede enviar valores autoritativos.
- Redondear cada componente: `Math.round(base * rate / 100)` equivalente en SQL/TypeScript.
- La excepción 100% es válida solo para manager, empleado distinto del actor y venta con servicio. Solo lleva el servicio al 100%; productos conservan su tasa habitual.
- Ejecutar venta, pagos, snapshots, stock, visita del cliente y movimientos de inventario en una sola transacción idempotente por `requestId`.

## Request V2

```json
{
  "requestId": "uuid",
  "employeeId": "uuid",
  "customerId": null,
  "serviceId": "uuid",
  "products": [{ "productId": "uuid", "quantity": 1 }],
  "payments": [
    { "method": "cash", "amount": 9500 },
    { "method": "transfer", "amount": 9500 }
  ],
  "grantFullServiceCommission": false
}
```

Rechazar campos extra como `registeredBy`, precios, total, fechas, tasas o importes calculados.

## Response V2 esperada

Además del detalle actual, devolver:

- `employee` responsable y `registeredBy` por separado.
- `payments[]` (uno o dos registros).
- `commission`: bases, tasas snapshot, importes por componente, total, neto y excepción/autorizador.
- Métricas de listado: `grossTotal`, `commissionTotal`, `barbershopNet`, manteniendo conteo y distribución por medios.

## Errores públicos sugeridos

- `EMPLOYEE_NOT_ELIGIBLE`
- `PAYMENT_ALLOCATION_MISMATCH`
- `INVALID_COMMISSION_OVERRIDE`
- `COMMISSION_RATE_OUT_OF_RANGE`
- `INCOME_REQUEST_CONFLICT`

No exponer detalles internos de SQL. Mantener los errores actuales de stock, cliente, servicio y producto.

## Pruebas backend mínimas

- Employee no puede atribuir la venta a otro usuario.
- Manager sí puede seleccionar usuario activo y no uno inactivo/eliminado.
- Pago simple y combinado exacto; faltante, excedente, cero, negativo y método duplicado fallan.
- Comisión separada de servicio/productos, redondeo, venta solo producto y tasas cero.
- Regalo 100% permitido y todas sus ramas prohibidas.
- Cambio posterior de tasas no altera ventas históricas.
- Anulación conserva snapshots y excluye importes de métricas.
- Idempotencia/concurrencia no duplica pagos, comisión, stock ni visitas.
- La respuesta nunca contiene hashes, tokens ni datos sensibles del usuario.

---

# Handoff backend: clientes fijos semanales

El frontend permite configurar cero o un horario semanal por cliente y presenta ocurrencias concretas en el dashboard. La persistencia, generación y auditoría todavía no existen. El formulario V2 envía `fixedSchedule`; como el schema actual de clientes es estricto, el backend vigente puede rechazar ese campo hasta completar esta integración.

## Reglas de dominio

- Cada cliente tiene como máximo un horario semanal activo.
- `weekday` usa ISO 8601: `1` lunes a `7` domingo.
- `time` usa hora local `HH:mm` en `America/Argentina/Buenos_Aires`.
- Cada semana genera una ocurrencia concreta con estado `pending`, `attended` o `missed`.
- Marcar asistencia no crea un ingreso, no registra un pago y no altera las semanas siguientes.
- Todos los usuarios autenticados que hoy pueden crear/editar clientes pueden configurar el horario y actualizar una ocurrencia. El servidor debe revalidar sesión y autorización en cada operación.

## Persistencia recomendada

Agregar una migración aditiva posterior a la de comisiones, sin reutilizar columnas de ingresos:

### `customer_fixed_schedules`

- `customer_id uuid primary key references customers(id)` garantiza un solo horario por cliente.
- `weekday smallint not null check (weekday between 1 and 7)`.
- `local_time time not null`.
- `is_active boolean not null default true`.
- `version integer not null default 1` para distinguir reprogramaciones.
- `created_by`, `updated_by` con referencia a `users`.
- `created_at`, `updated_at` con reloj de base de datos.

### `fixed_customer_occurrences`

- `id uuid primary key`.
- `schedule_customer_id uuid references customer_fixed_schedules(customer_id)`.
- `schedule_version integer not null`.
- `customer_id uuid references customers(id)` para consultas y auditoría explícitas.
- `occurrence_date date not null` y `scheduled_time time not null` como snapshots locales.
- `status text not null check (status in ('pending', 'attended', 'missed')) default 'pending'`.
- `status_updated_by uuid null references users(id)` y `status_updated_at timestamptz null`.
- `created_at timestamptz not null default now()`.
- Restricción única por `(schedule_customer_id, schedule_version, occurrence_date)`.

Habilitar RLS sin políticas para roles de navegador, igual que las tablas actuales. Sólo el cliente server secret accede a estas tablas.

## Generación idempotente

- Calcular fechas siempre con `America/Argentina/Buenos_Aires`; no derivarlas desde la zona horaria del navegador.
- Generar una ventana acotada, por ejemplo hoy más ocho semanas, al crear/reprogramar y mediante una tarea periódica.
- Usar `insert ... on conflict do nothing` sobre la clave única para que reintentos o concurrencia no dupliquen ocurrencias.
- No regenerar ni sobrescribir estados históricos.
- La lectura del dashboard debe pedir hoy y próximas fechas ordenadas por `occurrence_date`, `scheduled_time`.

## Alta y edición de clientes V2

Request de alta o edición:

```json
{
  "firstName": "Juan",
  "lastName": "Cruz",
  "email": "juan@example.com",
  "phone": "3515550101",
  "fixedSchedule": {
    "weekday": 4,
    "time": "10:00"
  }
}
```

`fixedSchedule: null` significa sin horario fijo. El servidor valida el día/hora, guarda cliente y horario en una transacción y devuelve:

```json
{
  "id": "uuid",
  "firstName": "Juan",
  "lastName": "Cruz",
  "email": "juan@example.com",
  "phone": "3515550101",
  "visits": 8,
  "createdAt": "2026-08-12T12:00:00.000Z",
  "fixedSchedule": {
    "weekday": 4,
    "time": "10:00"
  }
}
```

## Lectura y cambio de estado

Endpoint sugerido:

`GET /api/fixed-customer-occurrences?dateFrom=2026-08-12&dateTo=2026-08-31&status=pending`

Respuesta:

```json
{
  "data": {
    "occurrences": [
      {
        "id": "uuid",
        "customer": { "id": "uuid", "firstName": "Juan", "lastName": "Cruz" },
        "date": "2026-08-13",
        "time": "10:00",
        "status": "pending"
      }
    ]
  }
}
```

Actualización:

`PATCH /api/fixed-customer-occurrences/:id/status`

```json
{ "status": "attended", "expectedStatus": "pending" }
```

El backend obtiene el actor desde la sesión, aplica el cambio sólo si continúa `pending` y devuelve la ocurrencia actualizada. No aceptar cliente, fecha, hora ni actor desde el navegador.

## Reprogramación y desactivación

- Reprogramar incrementa `version`, conserva ocurrencias pasadas y las de hoy, elimina únicamente ocurrencias futuras todavía `pending` de la versión anterior y genera las futuras con el nuevo día/hora en la misma transacción.
- Desactivar conserva historial y elimina únicamente ocurrencias futuras `pending`; el horario queda `is_active = false`.
- Reactivar o cambiar el horario vuelve a generar desde la fecha de negocio actual sin duplicar ocurrencias.
- Ocurrencias `attended` o `missed` nunca se eliminan ni cambian por editar el horario.

## Errores públicos sugeridos

- `FIXED_SCHEDULE_INVALID`
- `FIXED_SCHEDULE_CONFLICT`
- `FIXED_OCCURRENCE_NOT_FOUND`
- `FIXED_OCCURRENCE_ALREADY_RESOLVED`
- `FIXED_OCCURRENCE_OUT_OF_RANGE`

## Pruebas backend mínimas

- Crear/editar cliente con horario válido y con `null`.
- Rechazar día fuera de `1..7`, hora inválida y campos extra.
- Garantizar un solo horario por cliente bajo concurrencia.
- Generación idempotente y correcta alrededor de cambios de día/mes/año en Buenos Aires.
- Dashboard ordenado por fecha/hora y excluyendo clientes eliminados.
- `pending -> attended` y `pending -> missed` auditan al actor.
- Un segundo cambio concurrente devuelve conflicto y no pisa el primer resultado.
- Reprogramar/desactivar conserva historial y reemplaza sólo futuras pendientes.
- Marcar asistencia no crea ingresos, pagos, comisiones, visitas ni movimientos de caja.

Aplicar estas tablas o funciones en Supabase modifica la base compartida. Volver a `dev` o cambiar de rama Git no deshace una migración: revisar el SQL, preparar rollback y ejecutarlo manualmente sólo cuando el equipo acuerde integrar el backend.
