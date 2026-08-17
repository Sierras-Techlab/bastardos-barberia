# Diseño de la vista de ingresos

Fecha: 2026-08-07

## Objetivo

Crear `/incomes` como la vista operativa para consultar las ventas registradas por Bastardos Barbería. La pantalla debe mantener la estética del dashboard y de `/incomes/new`, funcionar bien en notebook y teléfono, y quedar preparada para reemplazar los datos mock por el backend.

Esta vista responde a la pregunta: **¿qué ventas se registraron?** No reemplaza el libro diario de caja ni los reportes generales.

## Límites funcionales

- `/incomes`: ventas individuales y su detalle.
- `/cash`: futuro libro diario con entradas, salidas, gastos, compras, ajustes y cierres.
- `/reports`: futuros totales semanales, mensuales y anuales, comisiones, gastos fijos y ganancia neta.

Quedan fuera de esta entrega la conexión con el backend, la edición y anulación reales, la paginación de servidor, la exportación y los pagos divididos.

## Permisos

- El dueño puede consultar todos los ingresos recibidos por la vista.
- Un empleado solo puede consultar sus propios ingresos.
- La autorización real será responsabilidad del backend. Durante esta etapa, los datos mock simularán ambos escenarios y los componentes recibirán una colección ya autorizada.
- El detalle mostrará las acciones `Editar` y `Anular` deshabilitadas con la indicación `Próximamente`.
- La implementación futura permitirá corregir o anular solo al dueño y deberá conservar auditoría. Un ingreso anulado permanecerá registrado, pero no contará en las métricas.

## Estructura visual

La pantalla reutilizará el shell existente: sidebar oscuro, header superior fijo, fondo gris cálido, cards blancas redondeadas y acentos rojos.

### Encabezado

- Título `Ingresos`.
- Mes activo visible, inicialmente el mes actual.
- Acción principal `Cargar ingreso`, con navegación a `/incomes/new`.

### Métricas

Se mostrarán cuatro métricas compactas:

1. Total facturado.
2. Cantidad de ventas.
3. Promedio por venta.
4. Distribución monetaria entre efectivo y transferencia.

Las métricas se calcularán sobre los ingresos activos que coincidan con los filtros. Los ingresos anulados no participarán de los cálculos.

### Filtros

- Búsqueda por cliente, servicio o producto.
- Rango de fechas dentro del historial disponible.
- Empleado, visible únicamente para el dueño.
- Medio de pago: efectivo o transferencia.
- Tipo de venta: servicio, productos o combinada.
- Acción para limpiar todos los filtros.

El período inicial será el mes actual y el orden inicial será descendente por fecha de creación.

### Listado

En escritorio se utilizará TanStack Table. La tabla mostrará:

- Fecha y hora.
- Concepto resumido.
- Empleado responsable.
- Cliente o `Sin cliente`.
- Medio de pago.
- Total.
- Estado cuando esté anulado.

La tabla tendrá paginación local de 10 filas. Cada fila tendrá estados de hover y foco y podrá abrirse con mouse o teclado.

En móvil se reemplazará la tabla por cards compactas sin scroll horizontal. Cada card mostrará fecha, concepto, empleado, medio de pago, total y estado. Tocar una card abrirá el mismo detalle que en escritorio.

### Detalle

Seleccionar un ingreso abrirá un panel lateral de solo lectura con:

- Fecha y hora.
- Estado.
- Empleado.
- Cliente opcional.
- Servicio opcional.
- Productos y cantidades.
- Medio de pago.
- Total.
- Acciones `Editar` y `Anular` deshabilitadas como `Próximamente`.

## Modelo de presentación

Cada ingreso de la lista contendrá:

- `id`.
- `createdAt`.
- `employee`.
- `customer` opcional.
- `service` opcional.
- `products`, con producto y cantidad.
- `paymentMethod`.
- `total`.
- `status`: `active` o `voided`.

El mock incluirá un historial amplio del mes actual, con ambos empleados, clientes opcionales, los tres tipos de venta, efectivo, transferencia e ingresos anulados.

## Arquitectura de componentes

- `IncomesView`: coordina datos, filtros, paginación y selección.
- `IncomeMetrics`: presenta métricas derivadas de los resultados filtrados.
- `IncomeFilters`: administra búsqueda y filtros disponibles para el rol.
- `IncomeTable`: tabla de escritorio y paginación local.
- `IncomeMobileList`: representación móvil de la misma colección filtrada.
- `IncomeDetailSheet`: panel lateral de detalle.
- Funciones puras de dominio: filtrado, ordenamiento, métricas y clasificación del tipo de venta.

La tabla, las cards y el detalle compartirán una única fuente de datos. La lógica derivada no se duplicará dentro de los componentes visuales.

## Flujo de datos

1. La página entrega a `IncomesView` el usuario actual y una colección autorizada.
2. `IncomesView` mantiene el estado de filtros, página y selección.
3. Funciones puras generan la colección filtrada y ordenada.
4. Las métricas se calculan sobre esa misma colección.
5. Tabla o cards presentan los resultados según el breakpoint.
6. Seleccionar un registro abre `IncomeDetailSheet` sin solicitar datos adicionales durante la etapa mock.

Al integrar el backend, la fuente mock será reemplazada por un servicio. La autorización y el alcance de datos no dependerán de filtros de seguridad ejecutados solo en el cliente.

## Estados de interfaz

- `loading`: skeletons para encabezado de métricas y listado.
- `error`: mensaje contextual y acción `Reintentar`.
- `empty`: todavía no existen ingresos para el período.
- `no-results`: existen ingresos, pero ninguno coincide con los filtros; permitirá limpiarlos.
- `ready`: métricas, filtros y listado.

## Responsive y accesibilidad

- Escritorio: tabla con seis columnas, filtros compactos y panel lateral.
- Móvil: métricas en dos columnas, filtros secundarios dentro de una acción `Filtrar`, cards y panel lateral adaptado al ancho disponible.
- No habrá scroll horizontal en móvil.
- Filas, cards, botones y cierre del panel serán accesibles por teclado.
- Los controles tendrán nombres accesibles, foco visible y estados seleccionados reconocibles.
- El resumen sticky respetará la altura del header superior cuando corresponda.

## Pruebas

Se cubrirán:

- El dueño recibe opciones para filtrar por empleado.
- El empleado no recibe ese filtro y solo renderiza su colección autorizada.
- Cálculo de total, cantidad, promedio y distribución por medio de pago.
- Exclusión de ingresos anulados de las métricas.
- Búsqueda por cliente, servicio y producto.
- Combinación y limpieza de filtros.
- Clasificación de ventas de servicio, productos y combinadas.
- Orden descendente por fecha.
- Paginación local de 10 registros.
- Apertura y contenido del detalle.
- Acciones futuras deshabilitadas.
- Estados loading, error, empty y no-results.
- Renderizado accesible de tabla y cards.

La entrega se considerará verificable cuando pasen la suite completa, ESLint, el build de producción y una revisión visual en notebook y teléfono.
