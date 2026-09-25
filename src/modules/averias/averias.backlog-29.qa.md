# QA Backlog 2.9 — Historial y reportes de averías

Fecha: 25 de septiembre de 2026  
Alcance: 2.9.1 a 2.9.6 (historial general, pantalla, reporte resumen, registro de eventos, historial individual, línea de tiempo)  
Evidencia: Jest sobre sqljs, contraste de solo lectura contra SQL Server y Vitest del Frontend. No se recorrió el flujo en el navegador.

## Evidencia ejecutada

| Suite | Resultado |
|---|---|
| Backend 2.9 (historial, resumen, eventos, materiales, migración, integral, SQL Server) | 37/37 OK |
| Frontend 2.9 (historial, filtros, resumen, línea de tiempo, seguridad, API) | 52/52 OK |

Comando backend:

```
npx jest --testPathPatterns="averias.historial-admin.spec|averias.reporte-resumen.spec|averias.historial-eventos.spec|averias.eventos-historial.spec|historial-averia.materiales.spec|historial-averia.migration.spec|averias.backlog-29.integral.spec|averias.backlog-29.sqlserver.spec" --runInBand
```

Comando frontend:

```
npx vitest run src/modules/averias/admin/AveriasHistorialPage.test.tsx src/modules/averias/admin/averiasHistorialSearch.test.ts src/modules/averias/admin/AveriasReporteResumenPage.test.tsx src/modules/averias/admin/AveriasAdminEventosHistorial.test.tsx src/modules/averias/admin/averiasAdmin.security.test.tsx src/modules/averias/admin/averiasAdmin.noApi.test.ts src/modules/averias/services/averiasAdminApi.test.ts
```

## SQL Server en vivo

Consulta de solo lectura. El resumen del servicio coincidió con `COUNT` agrupado de `Averia`.

| Indicador | Cantidad |
|---|---|
| Total | 2 |
| Recibida | 0 |
| Asignada | 0 |
| Pendiente de atención | 1 |
| En atención | 0 |
| Resuelta | 0 |
| Cancelada | 1 |
| Otros | 0 |

Un periodo futuro (`2099-01-01` a `2099-01-02`) devolvió total 0.

Relaciones de `HistorialAveria`:

- `FK_HistorialAveria_Averia` hacia `Averia`, borrado `NO ACTION`.
- `FK_HistorialAveria_Usuario` hacia `Usuario`, borrado `SET NULL`.

No hay averías resueltas en esta base, así que la conservación del historial después de resolver se comprobó en la prueba integral (sqljs), no sobre filas reales.

## Matriz de criterios

| Criterio | Resultado | Evidencia |
|---|---|---|
| Historial general con Recibida, Asignada, Pendiente de atención, En atención y Resuelta | Cumple | `averias.historial-admin.spec` |
| Código, fechas, prioridad, tipo, Fontanero y sector | Cumple | Historial admin + prueba integral |
| Filtro por estado, prioridad, tipo, Fontanero, sector, fechas y código | Cumple | Historial admin + prueba integral |
| Filtros combinados, sin resultados y rango inválido | Cumple | AND en servidor; 200 con total 0; 400 si el rango está invertido o el estado es En proceso |
| Limpiar filtros | Cumple | `AveriasHistorialPage.test` |
| Paginación en servidor | Cumple | Historial admin y la consulta combinada con `limit=1` |
| Resumen con total y los cinco estados | Cumple | `averias.reporte-resumen.spec` y la prueba integral |
| Indicadores iguales a los registros almacenados | Cumple | La prueba integral compara el HTTP con el `COUNT` de la base de prueba. SQL Server: total 2 = 1 pendiente + 1 cancelada |
| Rango de fechas y periodo vacío | Cumple | Ceros en 2099, en sqljs y en SQL Server |
| Registro, asignación, pendiente, inicio, prioridad, clasificación, observación y resolución | Cumple | `averias.historial-eventos.spec` y la prueba integral. Cada acción agrega un evento; no reescribe los anteriores |
| Solicitud y salida de materiales | Cumple | `historial-averia.materiales.spec` |
| Línea de tiempo cronológica, con fecha, hora, descripción, responsable y estados | Cumple | `averias.eventos-historial.spec`, prueba integral y `AveriasAdminEventosHistorial.test` |
| Evento sin usuario | Cumple | El registro queda con `usuario` null y se muestra igual |
| Avería resuelta conserva el historial | Cumple | Tras resolver, el conteo y las descripciones siguen iguales |
| Sin editar ni eliminar desde la interfaz | Cumple | La línea de tiempo no renderiza esas acciones |
| Sin operación para modificar o borrar eventos | Cumple | PATCH, PUT y DELETE sobre el historial responden 404. `save` y `remove` del repositorio lanzan error y la fila no cambia |
| Administradora y Secretaria | Cumple | 200 en historial, resumen y línea de tiempo. Las pantallas quedan dentro del panel |
| Fontanero, Abonado, sin sesión y token inválido | Cumple | 403, 401 y redirección a login o acceso denegado. El Backend aplica el permiso |
| 404 y 400 del historial individual | Cumple | Avería inexistente 404; id no numérico 400 |
| Datos del reportante fuera del historial | Cumple | Teléfono, correo e identificación no salen en el listado ni en la línea de tiempo |

## Hallazgos

1. **SQL Server no tiene averías resueltas.** Hay una pendiente de atención y una cancelada. El total del resumen las incluye y coincide con la tabla. La traza completa de una avería resuelta quedó demostrada en la base de prueba, no en estas dos filas.
2. **Cancelada existe en la base y entra en el total.** No es uno de los cinco estados del flujo visible por defecto. El resumen la cuenta y la pantalla la muestra solo cuando la cantidad es mayor que cero.
3. **La pasada de navegador no se hizo.** Computadora, tableta y celular se cubrieron con las reglas de estilo y las pruebas de interfaz, no con un recorrido manual.

## Conclusión

El Backlog 2.9 queda validado en historial general, filtros, paginación, reporte resumen, registro automático de eventos, historial individual, línea de tiempo de solo lectura, permisos y persistencia de la relación `Averia`–`HistorialAveria`.

Queda pendiente una pasada manual en el navegador y, cuando exista una avería resuelta en SQL Server, confirmar sobre esa fila que el historial sigue completo.
