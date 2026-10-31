# Smoke test Backend SIGASJ en Render

Fecha/hora de ejecución: **2026-10-31T03:50:16Z** (UTC)  
Entorno: Web Service `sigasj-api`  
URL base: `https://sigasj-api.onrender.com`  
Rama desplegada (Render): `Wuipy`  
Commit desplegado (Render): **`9127fbe`** (`fix(deploy): incluir devDependencies…`)  
Estado deploy: **Failed**  
Health Check Path configurado: `/api/v1/health`

Herramienta: `npm run smoke:render` → `scripts/smoke-render.cjs`  
Variables (no versionadas): `API_BASE_URL`, `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`, `SMOKE_FONTANERO_EMAIL`, `SMOKE_FONTANERO_PASSWORD`, `SMOKE_TIMEOUT_MS`.

## Contrato inspeccionado (rutas reales)

| Uso | Método | Ruta efectiva |
| --- | --- | --- |
| Health | GET | `/api/v1/health` (público, `{ "status": "ok" }`) |
| Público | GET | `/api/v1/public/comunicados` |
| Averías públicas | GET `cedula` / POST | `/api/v1/public/averias` (POST no usado en smoke) |
| Login | POST | `/api/v1/auth/login` body `{ email, password }` → `{ accessToken, user }` (HTTP 200) |
| Protegido + SQL | GET | `/api/v1/usuarios` roles `ADMINISTRADORA`, `SECRETARIA` |
| Solo admin | GET | `/api/v1/admin/proyectos` rol `ADMINISTRADORA` |
| Prefijo | — | `api/v1` |
| JWT | — | `Authorization: Bearer` |
| Roles reales | — | `ADMINISTRADORA`, `SECRETARIA`, `FONTANERO`, `ABONADO`, `AYUDANTE` |

## Resultado de esta corrida

**BLOCKED — Backend Render 11.3.x no disponible (deploy Failed / proceso no Live).**  
Dependencia adicional: **11.4.5 Railway** (sin SQL alcanzable el proceso no permanece activo).

Evidencia:

1. `GET https://sigasj-api.onrender.com/api/v1/health` → **TIMEOUT** (~20–25 s).
2. Dashboard Render → Most recent deploy → **Failed** (`9127fbe`).
3. Runtime Logs (última hora): *No logs to show* / servicio no emitiendo (últimos logs ~1 h atrás).
4. `node scripts/smoke-render.cjs` → exit **2**, solo S1 BLOCKED; no se ejecutaron login/roles/SQL contra producción falsa.

No se declara PASS. No se usó localhost como sustituto de aceptación.

## Batería definida (cuando Render+Railway estén Live)

| ID | Endpoint | Método | Auth | Rol | Esperado |
| --- | --- | --- | --- | --- | --- |
| S1 | `/api/v1/health` | GET | No | — | 200 `{status:ok}` |
| S2 | `/api/v1/public/comunicados` | GET | No | — | 200 |
| S3 | `/api/v1/auth/login` | POST | credenciales sintéticas admin | ADMINISTRADORA | 200 + accessToken (no documentar) |
| S4 | `/api/v1/auth/login` | POST | password incorrecta | — | 401 |
| S5 | `/api/v1/usuarios` | GET | Bearer admin | ADMINISTRADORA | 200 (TypeORM→Railway) |
| S6 | `/api/v1/usuarios` | GET | Sin token | — | 401 |
| S7 | `/api/v1/usuarios` | GET | Bearer inválido | — | 401 |
| S8 | `/api/v1/admin/proyectos` | GET | Bearer fontanero | FONTANERO | 403 |
| S9 | `/api/v1/admin/proyectos` | GET | Bearer admin | ADMINISTRADORA | 200 |

Avería pública POST: **no ejecutada** (evitar escritura innecesaria; ya hay GET público de comunicados).

## Matrices de esta ejecución

### Smoke

| ID | Endpoint | Esperado | Actual | Resultado |
| --- | --- | --- | --- | --- |
| S1 | GET /api/v1/health | 200 | TIMEOUT | **BLOCKED** |
| S2–S9 | (definidos) | — | no ejecutados | **BLOCKED** (depende S1) |

### Autenticación / roles / Railway / logs

| Matriz | Estado |
| --- | --- |
| Auth (sin/inválido/válido) | No ejecutada — API caída |
| Roles (403 FONTANERO / 200 ADMIN) | No ejecutada |
| Railway vía TypeORM | No ejecutada — requiere 11.4.5 + proceso Live |
| Logs / requestId | Logs runtime vacíos; correlación no verificable en esta corrida |

## Clasificación del bloqueo

| Tipo | Detalle |
| --- | --- |
| DEPLOYMENT | Deploy `9127fbe` **Failed** |
| DATABASE | Arranque depende de SQL Server Railway (11.4.x / 11.4.5) |
| CONFIGURATION | Health Check Path correcto (`/api/v1/health`) pero proceso no escucha |

## Cómo re-ejecutar (cuando Live)

```bash
# Credenciales sintéticas solo en entorno local/CI secreto — nunca en Git
set API_BASE_URL=https://sigasj-api.onrender.com
set SMOKE_ADMIN_EMAIL=...
set SMOKE_ADMIN_PASSWORD=...
set SMOKE_FONTANERO_EMAIL=...
set SMOKE_FONTANERO_PASSWORD=...
npm run smoke:render
```

Criterio PASS: S1–S9 PASS, sin JWT/passwords en la salida, lectura SQL real vía `/usuarios` o `/admin/proyectos`.

## Confirmaciones

- No se crearon endpoints nuevos.
- No se hicieron pruebas exhaustivas 11.5.
- No se hardcodearon passwords/tokens en el repo.
- No se usaron datos personales reales.
- No commit / no push en esta tarea.
