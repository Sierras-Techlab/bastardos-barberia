# Dashboard simplificado y clientes fijos

## Objetivo

Simplificar el inicio para que muestre únicamente información operativa solicitada por el cliente: resumen de ingresos, acciones rápidas y clientes fijos. Preparar además el frontend de la recurrencia semanal desde `/customers` y ampliar el handoff de backend, sin modificar APIs, servicios, repositorios, SQL ni Supabase.

## Dashboard

El inicio se organiza en tres bloques:

1. Resumen de ingresos.
2. Acciones rápidas.
3. Clientes fijos.

Se eliminan del inicio los bloques de servicios destacados y actividad reciente.

### Resumen de ingresos

- El día actual es el período principal.
- Métricas compactas: total vendido, cantidad de ventas, promedio por venta y distribución por medios de pago.
- Un gráfico ancho muestra los últimos siete días para aportar contexto sin duplicar el historial de `/incomes`.
- Un enlace permite abrir todos los ingresos.
- Para employee, los datos corresponden exclusivamente a sus ingresos autorizados.
- Para owner/admin, los datos representan todo el negocio.
- Los valores seguirán dependiendo de las métricas autorizadas por backend; el frontend no reconstruye cifras privadas.

### Acciones rápidas

Todas las acciones quedan visibles para todos los roles porque un empleado puede operar solo la barbería:

- Cargar ingreso.
- Ver ingresos.
- Gestionar clientes.
- Ver productos.
- Registrar gasto.
- Cerrar caja.

Las rutas implementadas navegan normalmente. `Registrar gasto` y `Cerrar caja` muestran un toast accesible `Esta función estará disponible próximamente` hasta que sus módulos existan; no utilizan enlaces `#`.

Las operaciones futuras deben registrar el actor autenticado. Cerrar caja requerirá confirmación y control del backend; visibilidad no equivale a autorización.

## Clientes fijos

Un cliente puede tener como máximo un horario semanal recurrente. Ejemplo: `Todos los jueves a las 10:00`.

### Configuración en `/customers`

El formulario de alta y edición incorpora:

- Toggle `¿Tiene horario fijo?`.
- Día de la semana obligatorio si el toggle está activo.
- Hora obligatoria en formato `HH:mm` si el toggle está activo.
- Resumen legible de la recurrencia.
- Al desactivar el toggle, día y hora salen del payload V2.

Todos los roles que actualmente pueden crear o editar clientes pueden configurar el horario fijo. El backend debe volver a autorizar la operación.

### Ocurrencias

La recurrencia genera una ocurrencia por semana. Cada ocurrencia tiene exactamente uno de estos estados:

- `pending`: todavía no se registró el resultado.
- `attended`: el cliente asistió.
- `missed`: el cliente no asistió.

Cambiar el estado de una ocurrencia no elimina ni modifica la recurrencia semanal. El pago no pertenece a esta entidad; si el cliente asistió, la venta se registra desde ingresos.

### Presentación en el dashboard

- Card con las ocurrencias de hoy primero y próximas ocurrencias después.
- Cada fila muestra cliente, día/hora, fecha concreta y estado.
- Las ocurrencias pendientes permiten `Asistió` y `No asistió`.
- Estados confirmados muestran su resultado y no cambian accidentalmente con un solo clic.
- Enlace `Ver todos` apunta a la futura vista `/customers/fixed`.
- Un estado vacío explica que no hay clientes con horario fijo.
- Mientras backend esté pendiente, un fixture aislado permite validar la presentación; la interfaz conserva el distintivo de demostración y el fixture se reemplaza en un único límite de datos.

## Contratos frontend

- `FixedSchedule`: `weekday` de 1 a 7 y `time` `HH:mm`.
- `FixedCustomer`: identidad segura del cliente más `fixedSchedule`.
- `FixedCustomerOccurrence`: `id`, cliente, fecha local, hora y `status`.
- Los payloads V2 de cliente aceptan `fixedSchedule: FixedSchedule | null`.
- El cambio de asistencia envía solamente la ocurrencia y el estado solicitado; fecha, cliente y auditoría son autoritativos del servidor.

El frontend usa adaptadores explícitos para respuestas legacy. No inventa una recurrencia para clientes que no la tengan.

## Diseño responsive

- Escritorio: resumen/gráfico ocupan el área principal; acciones y clientes fijos forman un lateral equilibrado.
- Tablet: resumen a ancho completo y los otros dos bloques en columnas.
- Móvil: métricas, gráfico, acciones y clientes fijos se apilan; las acciones conservan objetivos táctiles cómodos.
- El dashboard puede tener scroll natural en pantallas pequeñas; no se fuerza a comprimir contenido por debajo de su legibilidad.

## Backend handoff

Se ampliará `docs/backend-handoffs/2026-08-12-income-commissions-and-split-payments.md` o se añadirá una sección claramente enlazada con:

- Columnas o tabla de recurrencia semanal.
- Restricción de un horario por cliente.
- Tabla de ocurrencias y estados.
- Zona horaria `America/Argentina/Buenos_Aires`.
- Generación idempotente de ocurrencias.
- Endpoints de lectura y cambio de estado.
- Auditoría del actor.
- Casos de reprogramación/desactivación y pruebas mínimas.
- Advertencia de que cambiar de rama Git no revierte migraciones aplicadas.

## Pruebas

- El dashboard solo contiene los tres bloques aprobados.
- Las métricas y consultas respetan alcance por rol.
- Todas las acciones aparecen; las pendientes muestran toast y no navegan a `#`.
- El formulario exige día/hora únicamente con recurrencia activa y envía un solo horario.
- El resumen semanal se formatea correctamente.
- Ocurrencias se ordenan por fecha/hora y cambian de pendiente a asistió/ausente.
- Cambiar una ocurrencia no altera las siguientes.
- Se validan estados vacíos, legacy, responsive y errores de backend.

