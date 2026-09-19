# QA Backlog 3.6 — Horario laboral e inicio de atención

Fecha: 19 de septiembre de 2026  
Alcance: 2.6.1 a 2.6.5 y validación funcional del Backlog 3.6  
Evidencia: Jest (sqljs + SQL Server LocalDB) y Vitest. No se recorrió el flujo en navegador.

## Evidencia ejecutada

| Suite | Resultado |
|---|---|
| `averias.fontanero-list.spec.ts` (GET listado Fontanero) | 3/3 OK |
| `averias.horario-laboral.integral.spec.ts` (flujo 3.6 de punta a punta) | 10/10 OK |
| `averias.horario-laboral.sqlserver.spec.ts` (esquema y persistencia viva) | 2/2 OK |
| `horario-laboral-fontanero.database.spec.ts` | OK |
| `horarios-laborales-fontanero.spec.ts` | OK |
| `validacion-horario-laboral-fontanero.spec.ts` + `.service.spec.ts` | OK |
| `averias.asignacion-horario.spec.ts` + `averias.asignacion.spec.ts` | OK |
| `averias.inicio-atencion.spec.ts` + `averias.iniciar-atencion.spec.ts` | OK |
| **Backend 3.6 (10 suites)** | **79/79 OK** |
| Frontend: pendiente, detalle/listado Fontanero, listado/detalle admin, API inicio | **88/88 OK** |

Comando backend:

```
npx jest --testPathPatterns="averias.horario-laboral.integral.spec|averias.horario-laboral.sqlserver.spec|validacion-horario-laboral-fontanero.service.spec|averias.asignacion-horario.spec|averias.inicio-atencion.spec|averias.iniciar-atencion.spec|averias.asignacion.spec|horario-laboral-fontanero.database.spec|horarios-laborales-fontanero.spec|validacion-horario-laboral-fontanero.spec" --runInBand
```

Comando frontend:

```
npm test -- src/modules/averias/utils/averiaPendienteAtencion.test.ts src/modules/averias/fontanero/AveriasFontaneroDetailPage.test.tsx src/modules/averias/admin/AveriasAdminDetailPage.test.tsx src/modules/averias/admin/AveriasAdminTable.test.tsx src/modules/averias/admin/AveriasAdminPage.test.tsx src/modules/averias/services/averiasFontaneroApi.test.ts src/modules/averias/fontanero/fontaneroAveriaPresentation.test.ts
```

## Matriz de criterios

| Criterio | Resultado | Evidencia |
|---|---|---|
| Horario de Fontanero A se almacena | Cumple | Lunes 07:00–16:00 persistido; SQL Server inserta/consulta y hace rollback |
| SIGASJ determina si está dentro de horario | Cumple | 10:00 CR → dentro; 06:59 → fuera; 16:00 → fuera; martes → sin jornada |
| Asignación dentro de horario queda Asignada | Cumple | PATCH `/admin/averias/:id/asignacion` → `ASIGNADA` |
| Asignación fuera de horario queda Pendiente de atención | Cumple | Estado persistido `PENDIENTE`; no existe `FUERA_DE_HORARIO` |
| El Fontanero continúa asignado | Cumple | `idFontaneroAsignado` y `fontanero` en detalle admin/fontanero |
| Fuera de horario no se usa como estado | Cumple | Enum, persistencia sqljs y `DISTINCT estado` en SQL Server |
| Fuera de horario no inicia atención | Cumple | PATCH iniciar → 400 con mensaje de jornada |
| Intento rechazado no registra `fechaInicioAtencion` | Cumple | Columna nula tras 400 |
| Dentro de horario: Pendiente → En atención | Cumple | 200 + fecha del Backend |
| Dentro de horario: Asignada → En atención | Cumple | 200 + fecha del Backend |
| La fecha de inicio la pone el Backend | Cumple | Body con fecha/estado del cliente → 400; DTO vacío |
| PATCH admin a `EN_ATENCION` aplica la misma regla | Cumple | Fuera de jornada → 400; no cambia estado ni fecha |
| Administración ve estados y responsable | Cumple | GET listado (`estado=ASIGNADA\|PENDIENTE\|EN_ATENCION`) y detalle |
| Fontanero ve la situación en el detalle | Cumple | GET `/fontanero/averias/:id`; UI con aviso de horario |
| Listado Fontanero | Cumple | GET `/fontanero/averias` lista Asignada / Pendiente / En atención del JWT. Resueltas no aparecen. UI consume el API |
| Etiqueta Pendiente de atención | Cumple | Backend `ESTADO_AVERIA_LABELS.PENDIENTE` y Frontend coinciden |
| Sin sesión | Cumple | GET/PATCH 401 |
| Otro Fontanero | Cumple | GET/PATCH 403; no cambia la avería |
| Administradora en endpoint Fontanero | Cumple | PATCH iniciar → 403 |
| 400 / 401 / 403 sin textos técnicos | Cumple | Mensaje de negocio; no TypeORM/SQL/stack |
| La validación no se evita desde el Frontend | Cumple | Botón no se deshabilita por reloj; el Backend decide |
| SQL Server | Cumple | Tabla `HorarioLaboralFontanero`, inserta 07:00–16:00, Averia sin `FUERA_DE_HORARIO` |
| Computadora / tableta / celular | Parcial | API viva: 401 sin sesión, 200 Fontanero, 403 Administradora. Sin automatización de navegador |

## Hallazgos

1. **El listado Fontanero ya consulta el Backend.** `GET /fontanero/averias` solo incluye averías asignadas al JWT en Asignada, Pendiente de atención o En atención. Las resueltas salen del listado operativo.
2. **La etiqueta de `PENDIENTE` es “Pendiente de atención”** en Backend y Frontend. El valor persistido sigue siendo `PENDIENTE`.
3. **El SMS de fuera de horario no se envía.** La asignación solo prepara el evento. Queda en el Backlog 2.8.
4. **No hay vacaciones, incapacidades ni feriados.** El reloj usa `America/Costa_Rica` y la jornada configurada.

## Conclusión

El Backlog 3.6 queda validado funcionalmente: el horario se almacena, SIGASJ decide si el Fontanero está en jornada, la asignación queda Asignada o Pendiente de atención sin inventar un estado “Fuera de horario”, el inicio de atención se bloquea fuera de jornada sin fecha de inicio, y dentro de jornada pasa a En atención con fecha del servidor. Administración y Fontanero ven al responsable y los tres estados. El Fontanero consulta su listado operativo. Las reglas de 401/403 y la validación de Backend se cumplen.
