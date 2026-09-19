# QA Backlog 2.5 — Atención de averías del Fontanero

Fecha: 19 de septiembre de 2026  
Alcance: 2.5.1 a 2.5.5 (consulta, vista, observaciones, cierre, interfaz de observaciones)  
Evidencia: suites Jest/Vitest ejecutadas en esta sesión. No se recorrió el flujo en navegador ni en SQL Server en vivo.

## Evidencia ejecutada

| Suite | Resultado |
|---|---|
| `averias.fontanero-atencion.integral.spec.ts` (flujo 2.5 de punta a punta) | 9/9 OK |
| Detalle Fontanero, observaciones, resolver, gestión 2.3, detalle admin, DTOs | 81/81 OK |
| Frontend: detalle Fontanero, seguridad, API, detalle/gestión admin | 60/60 OK |

Comando backend:

```
npx jest --testPathPatterns="averias.fontanero-detail.spec|averias.observaciones.spec|averias.resolver.spec|averias.gestion.spec|averias.admin-detail.spec|averias.fontanero-atencion.integral.spec|resolver-averia.dto.spec|create-observacion-averia.dto.spec" --runInBand
```

## Matriz de criterios

| Criterio | Resultado | Evidencia |
|---|---|---|
| Fontanero asignado consulta su detalle | Cumple | GET `/fontanero/averias/:id` 200; vista `/fontanero/averias/:id` |
| Otro Fontanero no consulta ni modifica | Cumple | GET/POST/PATCH 403; Frontend 403 sin revelar el reporte |
| Sin sesión | Cumple | 401 en GET/POST/PATCH; ruta redirige a login |
| Administradora / Secretaria / Abonado en rutas Fontanero | Cumple | 403 Acceso denegado |
| Código, fechas, sector, ubicación, descripción, estado, reportante | Cumple | HTTP + UI |
| Tipo y prioridad se muestran | Cumple | Lectura en detalle Fontanero y admin |
| Pendientes (sin tipo, sin prioridad, sin observaciones, no iniciada, resuelta) | Cumple | Placeholders sin `null`/`undefined` |
| Varias observaciones coexisten | Cumple | 3 POST; recarga GET conserva las 3 |
| Autor, fecha y hora automáticos | Cumple | Backend; UI muestra autor y fecha |
| Vacío / solo espacios rechazados | Cumple | Frontend no llama API; Backend 400 |
| Texto se conserva si falla el registro | Cumple | UI de observaciones |
| Cierre solo desde En atención | Cumple | Recibida / Asignada / Pendiente / Resuelta → 400 |
| Cierre exige observación final | Cumple | Vacío y espacios → 400 |
| Cancelar cierre no cambia la avería | Cumple | UI; no hay PATCH |
| Cierre válido → Resuelta + fecha + observación final | Cumple | PATCH resolver + persistencia sqljs |
| Administración ve el caso actualizado | Cumple | GET admin detalle y listado `estado=RESUELTA` |
| Resuelta no aparece en En atención | Cumple | Listado admin filtrado |
| 400 / 401 / 403 / 404 sin datos sensibles | Cumple | Suites HTTP |
| Clasificar/prioridad desde la pantalla Fontanero | No implementado | Solo lectura; mutación es admin 2.3 |
| Iniciar atención desde la pantalla Fontanero | No implementado | No hay acción ni endpoint Fontanero |
| Fecha de inicio al pasar a En atención | Brecha | `updateEstado` no asigna `fechaInicioAtencion` |
| Listado Fontanero de pendientes/resueltas | No implementado | GET listado Fontanero es placeholder |
| Catálogo Tubo madre / Tubo medidor | Discrepancia 2.3 | Persistido: `TUBERIA_DANADA`, `MEDIDOR`, `FUGA`, etc. |
| Persistencia SQL Server en vivo | No ejecutado | `RUN_SQLSERVER_INTEGRATION` no activo |
| Computadora / tableta / celular y Network | No ejecutado | Sin herramientas de navegador en esta sesión |

## Hallazgos

1. **Clasificación y prioridad no se editan en `/fontanero/averias/:id`.** El Fontanero las ve. Administración las cambia con `PATCH /admin/averias/:id/clasificacion` y `/prioridad`. El detalle Fontanero refleja esos valores.
2. **No existe “Iniciar atención” en la vista ni en `/fontanero/averias`.** `ASIGNADA → EN_ATENCION` y `PENDIENTE → EN_ATENCION` solo están en gestión administrativa. Además, ese PATCH no genera `fechaInicioAtencion`.
3. **El listado del Fontanero no consulta el Backend.** No se puede comprobar en esa pantalla que un caso resuelto deje de verse como pendiente. El listado administrativo sí filtra `EN_ATENCION` vs `RESUELTA`.
4. **El tipo de avería del sistema no usa “Tubo madre / Tubo medidor”.** Es el catálogo de 2.3.

## Fuera de alcance (según ticket)

Horario laboral, materiales, SMS, notificaciones internas, historial global.

## Conclusión

El Backlog 2.5 queda validado para consulta asignada, aislamiento entre Fontaneros, observaciones múltiples, cierre formal con observación final y consulta administrativa posterior.

Queda pendiente de producto: acciones Fontanero de clasificación, prioridad e inicio de atención; fecha automática de inicio; listado operativo del Fontanero; y una pasada manual en navegador/SQL Server.
