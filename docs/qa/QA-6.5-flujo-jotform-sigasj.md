# QA 6.5 — Flujo Jotform → SIGASJ → aprobación RRHH

**Área:** Testing / Integración / Backend / Frontend / Base de Datos  
**Prioridad:** Alta  
**Fecha de ejecución:** 2026-10-19  
**Rama:** `Wuipy`  
**Entorno DB:** `DB_TYPE=mssql` (SQL Server físico configurado en `.env`)

## Objetivo

Validar de punta a punta que las solicitudes de ausencia funcionen desde el ingreso (Jotform o alta nativa Fontanero) hasta la aprobación/rechazo en RRHH, con coherencia API ↔ Frontend ↔ SQL Server.

## Resumen ejecutivo

| Capa | Resultado | Evidencia |
|------|-----------|-----------|
| API Backend (sqljs / Nest) | **PASS** 40/40 | `evidencia-6.5/api-epic65-20261019-180750.log` |
| SQL Server (flujos admin + fontanero) | **PASS** 5/5 | `evidencia-6.5/sqlserver-20261019-180809.log` |
| Unitarios Backend (mapper, entity, correo, días) | **PASS** 20/20 | consola 2026-10-19 |
| Frontend Vitest (solicitudes-ausencia) | **PASS** 41/41 | `evidencia-6.5/frontend-vitest.log` |
| Webhook live desde Jotform.com | **BLOQUEADO** | Falta `JOTFORM_WEBHOOK_SECRET` en `.env` |
| Migración física 6.5.1 (suite larga) | **FAIL / timeout** hook 15s | `evidencia-6.5/api-sqljs-20261019-180547.log` (no bloquea flujos funcionales SQL) |

**Veredicto funcional (API + SQL Server + FE automatizado):** criterios de aceptación de negocio **cumplidos** en pruebas automatizadas.  
**Pendiente manual:** envío real desde el formulario Jotform (requiere secreto de webhook y Backend en ejecución).

---

## Matriz de criterios de aceptación

| Criterio | Estado | Cómo se validó |
|----------|--------|----------------|
| Jotform/webhook crea exactamente una solicitud pendiente | PASS (API) | `submission duplicada es idempotente`; `concurrencia con el mismo submissionID` |
| Permiso aprobado genera exactamente un `PermisoColaborador` | PASS (API + SQL) | API `aprobar PERMISO…`; SQL `flujo PERMISO: aprueba y crea exactamente 1 PermisoColaborador` |
| Vacaciones aprobadas generan exactamente un movimiento `DISFRUTADO` | PASS (API + SQL) | API `aprobar VACACIONES…`; SQL `flujo VACACIONES: DISFRUTADO único y saldo final correcto` |
| El saldo permanece coherente | PASS (API + SQL) | Aprobación con saldo; rechazo de vacaciones sin saldo (400, sigue PENDIENTE) |
| Rechazar no crea registros oficiales | PASS (API + SQL) | API `rechazar PERMISO y VACACIONES: sin RRHH`; SQL `flujo RECHAZO: RECHAZADA sin registros RRHH` |
| Un `submissionID` repetido no duplica | PASS (API) | Idempotencia + concurrencia mismo submission |
| No existe doble aprobación | PASS (API) | `doble aprobación 409`; concurrencia dos PATCH → 1 RRHH |
| Fontanero sin Colaborador recibe error claro | PASS (API + FE) | API 403 alta/listado; FE deniega rutas |
| Los usuarios no pueden ver información ajena | PASS (API + SQL + FE) | Detalle ajeno 404; listado A/B; FE roles |
| API, Frontend y SQL Server coinciden | PASS parcial | SQL fontanero: listado/detalle vs SQL; FE consume mismos endpoints |
| Existe evidencia de pruebas | PASS | Carpeta `docs/qa/evidencia-6.5/` + este documento |

---

## Pruebas API documentadas (Backend)

Suite: `src/modules/solicitudes-ausencia/solicitudes-ausencia.api.spec.ts`

### 6.5.2 Webhook Jotform
- Crea PERMISO PENDIENTE sin RRHH.
- Crea VACACIONES PENDIENTE sin `MovimientoVacaciones` ni descuento.
- Secreto inválido → 401, no persiste.
- `formId` ajeno → 400.
- Submission duplicada / concurrencia → una sola fila.
- Ignora `colaboradorId` del payload (identidad por correlación).
- Token inválido / tipo INCAPACIDAD / fechas inválidas / payload incompleto → 400.

### 6.5.4 Admin aprobar / rechazar
- Listado con filtros y paginación.
- Aprobar PERMISO → 1 `PermisoColaborador`; doble → 409.
- Aprobar VACACIONES → 1 `DISFRUTADO` y saldo afectado; doble → 409.
- Vacaciones sin saldo → 400, permanece PENDIENTE.
- Rechazar → sin RRHH; doble rechazo → 409.
- Roles: sin JWT 401; FONTANERO/SECRETARIA 403; ADMINISTRADORA OK.
- Concurrencia dos aprobar → 1 registro RRHH.

### 6.5.3 Fontanero
- Alta nativa PENDIENTE + notificación campana admin.
- Sin Colaborador → 403.
- Listado/detalle propios; ajeno → 404.
- Aislamiento entre Fontaneros A/B.

**Comando:**
```bash
npx jest --testPathPatterns=solicitudes-ausencia.api.spec --no-coverage --runInBand
```

---

## Pruebas SQL Server documentadas

### Admin (`solicitudes-ausencia-admin.sqlserver.spec.ts`)
1. Flujo PERMISO: aprueba y crea exactamente 1 `PermisoColaborador`.
2. Flujo VACACIONES: `DISFRUTADO` único y saldo final correcto.
3. Flujo RECHAZO: `RECHAZADA` sin registros RRHH.

### Fontanero (`solicitudes-ausencia-fontanero.sqlserver.spec.ts`)
1. Listado API coincide con SQL por `colaboradorId` de A.
2. Detalle propio coincide; detalle ajeno 404.

**Comando:**
```bash
npx jest --testPathPatterns="solicitudes-ausencia-admin.sqlserver|solicitudes-ausencia-fontanero.sqlserver" --no-coverage --runInBand
```

---

## Pruebas Frontend documentadas

Suite Vitest: `sigasj_fronted/src/modules/solicitudes-ausencia/`

| PBI | Cobertura |
|-----|-----------|
| 6.5.5 Solicitar | Formulario nativo, envío, roles, sin secretos Jotform en markup |
| 6.5.6 Mis solicitudes | Listado, detalle, vacío, error, aislamiento de roles |
| 6.5.7 Cola admin | Filtros, aprobar PERMISO/VACACIONES, rechazo, 409, denegación Fontanero/Secretaria |
| API client | GET/POST Fontanero y PATCH Admin |

**Comando (Frontend):**
```bash
npx vitest run src/modules/solicitudes-ausencia/
```

---

## Pruebas manuales (checklist live Jotform)

> **Bloqueo actual:** en `.env` solo está `JOTFORM_FORM_ID`. No hay `JOTFORM_WEBHOOK_SECRET`.  
> Sin secreto, el webhook responde 401 y no se puede completar el envío real desde Jotform.

### Precondiciones
1. Backend corriendo con `DB_TYPE=mssql` y migraciones 6.5 aplicadas.
2. Configurar `JOTFORM_WEBHOOK_SECRET` y la misma clave en la URL del webhook Jotform (`?key=...`).
3. Fontanero con `Colaborador.usuarioId` vinculado y activo.
4. Administradora activa.

### Pasos
| # | Acción | Resultado esperado | Evidencia a guardar |
|---|--------|--------------------|---------------------|
| 1 | Login Fontanero → emitir correlación / abrir formulario | Token válido | captura + log Backend |
| 2 | Enviar PERMISO desde Jotform | Webhook 200/201, `creada=true` | log webhook + SQL `SolicitudAusencia` |
| 3 | Ver Mis solicitudes | Aparece PENDIENTE | captura FE |
| 4 | Cola admin RRHH | Aparece en listado | captura FE |
| 5 | Aprobar PERMISO | 1 `PermisoColaborador` | SQL count |
| 6 | Enviar VACACIONES con saldo | PENDIENTE sin movimiento | SQL |
| 7 | Aprobar VACACIONES | 1 `DISFRUTADO`; saldo baja | SQL saldo antes/después |
| 8 | Rechazar otra solicitud | Sin RRHH | SQL |
| 9 | Reenviar mismo submissionID | `creada=false`, sin duplicar | log + SQL |
| 10 | Doble clic Aprobar | Segunda respuesta 409 | captura/red |
| 11 | Fontanero sin Colaborador | 403 claro | captura |
| 12 | Fontanero B abre detalle de A | 404 | captura |

---

## Hallazgos

1. **Webhook live no ejecutado:** falta `JOTFORM_WEBHOOK_SECRET` en el entorno local. El comportamiento del webhook sí está cubierto por API (sqljs) con secreto de prueba.
2. **Suite de migración 6.5.1** (`solicitud-ausencia.database.spec.ts` sección SQL Server): timeout 15s en `beforeAll` al conectar/migrar. Los flujos funcionales SQL Server (5 pruebas) pasaron con el mismo `DB_TYPE=mssql`.
3. No se detectaron regresiones en idempotencia, doble aprobación, aislamiento entre Fontaneros ni generación RRHH.

---

## Orden PBI (referencia)

`6.5.1 → 6.5.2 → 6.5.3 → 6.5.4 → 6.5.5 → 6.5.6 → 6.5.7 → 6.5.8`

Cobertura automatizada presente para 6.5.1–6.5.7. 6.5.8 (si aplica operación/observabilidad) no se ejecutó como suite aparte en esta corrida.

---

## Evidencia adjunta

```
docs/qa/evidencia-6.5/
  api-epic65-20261019-180750.log      # API 40/40
  api-sqljs-20261019-180547.log       # corrida mixta (incluye fallos timeout migración)
  sqlserver-20261019-180809.log       # SQL 5/5
  frontend-vitest.log                 # FE 41/41
```
