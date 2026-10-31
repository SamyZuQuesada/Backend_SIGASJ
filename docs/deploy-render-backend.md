# Despliegue Backend SIGASJ en Render (Web Service / Node)

Alcance: GitHub → Build NestJS → `dist` → `start:prod` → `PORT` → `0.0.0.0` → HTTPS.

Fuera de alcance de este documento: SQL Server productivo (11.4), CORS definitivo (11.3.2), auth productiva, endpoints nuevos.

## Inspección del repositorio

| Ítem | Valor real |
| --- | --- |
| Repositorio | `https://github.com/SamyZuQuesada/Backend_SIGASJ` |
| Tipo | Repo Backend puro (no monorepo) |
| Root Directory en Render | _(vacío / raíz del repo)_ |
| Package manager | **npm** (`package-lock.json`) |
| Install | `npm ci --ignore-scripts --include=dev && npm rebuild bcrypt` |
| Build | `npm run build` → `nest build` |
| Nota install | `--include=dev` es obligatorio si `NODE_ENV=production` (si no, falta `@nestjs/cli` / `nest: not found`) |
| Start producción | `npm run start:prod` → `node dist/main` |
| Artifact | `dist/main.js` |
| Node | `engines.node`: `>=22.12.0 <23`; `.nvmrc`: `22` |
| Puerto | `process.env.PORT` vía `environment.config.ts`, fallback `3000` |
| Host | `app.listen(port, '0.0.0.0')` en `src/main.ts` |
| Dockerfile | Existe (local `start:dev`). **No** se usa para este Web Service. |
| Runtime elegido | **Node** (Nest estándar; Docker no es obligatorio) |

### Por qué `--ignore-scripts` + `npm rebuild bcrypt`

`msnodesqlv8` es nativo de Windows. En Linux (Render) su postinstall falla. Se omiten scripts de install y se recompila solo `bcrypt`, que sí es necesario.

## Rama y commit de referencia

| Campo | Valor |
| --- | --- |
| Rama aprobada | `main` |
| Commit en GitHub (`origin/main`) | `0eb935794c603331e3f6896b501ce81fd78965c0` |
| Auto-Deploy | solo rama `main` |

No desplegar ramas de desarrollo no autorizadas.

> El cambio local `app.listen(port, '0.0.0.0')` está en el working tree y **aún no** está en GitHub (esta tarea no autoriza commit/push). Hasta que se publique ese commit, Render desplegará el SHA anterior, donde Nest usa `app.listen(port)` sin host explícito.

## Evidencia local (mismo flujo que Render)

| Etapa | Comando | Resultado |
| --- | --- | --- |
| Build | `npm run build` | PASS (exit 0) |
| Artifact | `dist/main.js` | PASS (incluye `listen(port, '0.0.0.0')`) |
| Start prod | `npm run start:prod` con `PORT=3411` | PASS — log: `escuchando en 0.0.0.0:3411` |
| Health | `GET http://127.0.0.1:3411/api/v1/health` | PASS — HTTP 200 |
| Host | `Get-NetTCPConnection` | PASS — `0.0.0.0:3411 Listen` |

Mensaje Nest observado: `Nest application successfully started`.

## Configuración del Web Service (Render Dashboard)

| Campo | Valor |
| --- | --- |
| Tipo | Web Service |
| Runtime | Node |
| Repository | `SamyZuQuesada/Backend_SIGASJ` |
| Branch | `main` |
| Root Directory | _(vacío)_ |
| Build Command | `npm ci --ignore-scripts --include=dev && npm rebuild bcrypt && npm run build` |
| Start Command | `npm run start:prod` |
| Node version | `22` (alineado a `.nvmrc` / `engines`) |

No ejecutar `build` dentro del Start Command.

## Variables (nombres; valores solo en Render)

### Obligatorias para que el proceso intente arrancar y leer config

| Variable | Obligatoria al bootstrap | Secreto | Notas |
| --- | --- | --- | --- |
| `PORT` | Proveída por Render | No | No fijar a mano el puerto público |
| `NODE_ENV` | Recomendada `production` | No | |
| `DB_TYPE` | Sí (TypeORM) | No | Valor típico `mssql` |
| `DB_HOST` | Sí para permanecer activo | No | **11.4** |
| `DB_PORT` | Sí para permanecer activo | No | **11.4** |
| `DB_USERNAME` | Sí para permanecer activo | Sí | **11.4** |
| `DB_PASSWORD` | Sí para permanecer activo | Sí | **11.4** |
| `DB_DATABASE` | Sí para permanecer activo | No | **11.4** |
| `JWT_SECRET` | Tiene fallback de desarrollo en código | Sí | No versionar el valor real |

### Funcionales / opcionales (no bloquean este backlog)

`MAIL_*`, `JOTFORM_*`, `SMS_*`, `ACUEDUCTOS_CR_*`, `FRONTEND_BASE_URL`, `CORS_*` (CORS → 11.3.2).

### Dependencia crítica documentada (11.4)

TypeORM (`TypeOrmModule.forRootAsync`) conecta en el bootstrap. Sin SQL Server alcanzable el proceso **no** permanece estable (riesgo de restart loop). Esta tarea **no** configura SQL Server; solo lo registra.

## Comprobación HTTP

Rutas existentes (sin crear endpoints nuevos):

- `GET /api/v1/health` → salud
- `GET /api/docs` → Swagger (si el entorno lo sirve)

Un `401` en ruta protegida también demuestra que la API responde.

## Registro de deploy (completar al publicar)

| Campo | Valor |
| --- | --- |
| Nombre del servicio | |
| URL HTTPS | |
| Fecha/hora deploy | |
| Commit esperado | |
| Commit mostrado por Render | |
| Estado | |
| Build | |
| Start | |
| Restart loop | No / Sí |
| Ruta de prueba | `/api/v1/health` |
| Status HTTP | |
