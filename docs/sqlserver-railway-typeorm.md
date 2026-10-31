# SQL Server (Railway) — TypeORM seguro

Alcance: TypeORM + `mssql`, variables de entorno, TLS, pool, timeouts, retries, `synchronize: false`, migraciones, probe `SELECT 1`.
Fuera de alcance: crear SQL Server, migrar datos productivos, nuevas entidades, alterar esquema productivo automáticamente.

## Configuración TypeORM

| Ítem | Valor |
| --- | --- |
| Nest | `TypeOrmModule.forRootAsync` → `src/config/database.config.ts` |
| CLI / migraciones / probe | `src/database/data-source.options.ts` → `buildMigrationDataSourceOptions()` |
| Driver | `mssql` (`DB_TYPE=mssql`) |
| TypeORM (lock) | `1.1.0` |
| `mssql` (lock) | `12.7.0` |
| `synchronize` | **siempre `false`** (salvo fallback sqljs LocalDB roto) |
| `migrationsRun` | **`false`** (ejecución explícita) |
| Migrations | `src/database/migrations/` |
| Script run | `npm run migration:run` → `scripts/run-migrations.cjs` |
| Probe | `npm run db:probe` → `SELECT 1` |

## Variables (nombres; sin valores)

| Variable | Uso | Prod |
| --- | --- | --- |
| `DB_TYPE` | Debe ser `mssql` | Sí |
| `DB_HOST` | Host TCP **externo** Railway (no localhost) | Sí |
| `DB_PORT` | Puerto TCP **externo** Railway (número; no asumir 1433) | Sí |
| `DB_DATABASE` | Base SIGASJ | Sí |
| `DB_USERNAME` | Usuario de aplicación (**≠ `sa`**) de 11.4.x | Sí |
| `DB_PASSWORD` | Secreto solo en Render | Sí |
| `DB_ENCRYPT` | Cifrado TDS/TLS (`true` en prod) | Recomendado |
| `DB_TRUST_SERVER_CERTIFICATE` | `false` en prod (validar cert) | Recomendado |
| `DB_SSL_CA` / `DB_SSL_CA_PATH` | CA PEM si el cert no está en el trust store de Node | Si aplica |
| `DB_TRUSTED_CONNECTION` | Solo Windows Auth / LocalDB local | No en Render |

No existen `VITE_DB_*`. El Frontend no conoce SQL.

## TLS

| Entorno | encrypt | trustServerCertificate | Notas |
| --- | --- | --- | --- |
| production | `true` | `false` | Validación real; CA vía `DB_SSL_CA(_PATH)` si Railway lo requiere |
| development / test | `false` por defecto | `true` por defecto | Autofirmado local; no usar en Render |
| Escape prod | `true` | `true` solo si `DB_TRUST_SERVER_CERTIFICATE=true` | **No** es solución permanente |

Prohibido: `NODE_TLS_REJECT_UNAUTHORIZED=0`.

El certificado concreto de la instancia Railway **no se inventa**: se configura cuando 11.4.1–11.4.4 entreguen host/CA reales.

## Pool / timeouts / retry

| Parámetro | Valor | Justificación |
| --- | --- | --- |
| pool.max | 10 | Una instancia Nest; margen sin agotar SQL |
| pool.min | 0 | No retener ociosas en Free/starter |
| idleTimeoutMillis | 30000 | Liberar idle |
| connect/connectionTimeout | 30000 | Apertura razonable |
| requestTimeout | 30000 | Sin “infinito” |
| retryAttempts | 5 | Limitado |
| retryDelay | 3000 ms | Espaciado; sin tormenta |

Si la DB no está disponible al bootstrap: TypeORM/Nest agotan reintentos y el proceso **falla** (en Render → restart loop hasta que Railway/SQL respondan). Documentado; no ocultar.

## Migraciones (plan; no ejecutar productivas aquí)

1. Compilar / tener deps (`npm ci` / `npm run build` según entorno).
2. Cargar variables de producción en el shell o Render (sin imprimir secretos).
3. Revisar pendientes: `npx ts-node -r tsconfig-paths/register src/database/inspect-environment.ts` (o probe + logs).
4. Ejecutar explícitamente: `npm run migration:run`.
5. Verificar tablas / `typeorm_migrations`.
6. Iniciar Backend: `npm run start:prod`.

## Prueba de conexión

```bash
npm run db:probe
```

Consulta: `SELECT 1`. Sin INSERT/UPDATE/DELETE. Errores pasan por `sanitizeDbErrorMessage` (sin password).

## Render

Configurar en el Web Service (Dashboard), **por nombre**:

`DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE`, y si aplica `DB_SSL_CA` / `DB_SSL_CA_PATH`.

Blueprint: `render.yaml` (secretos `sync: false`).

## Bloqueos 11.4.x

- **BLOCKED — host/port TCP Railway reales** pendientes de 11.4.1–11.4.4.
- **BLOCKED — usuario SQL de aplicación** (≠ `sa`, mínimo privilegio) pendiente de 11.4.x.
- **BLOCKED — prueba final Render → Railway** hasta credenciales + CA/certificado conocidos.
- No se crea SQL Server en este backlog.
- No se migran datos productivos aquí.

## Matrices resumidas

### Config por entorno

| Config | Development | Test | Production |
| --- | --- | --- | --- |
| host | env / localhost | env / test DB | env Railway TCP |
| port | env | env | env Railway |
| user/password | env | env | env Render secrets |
| encrypt | false* | false* | true |
| trustServerCertificate | true* | true* | false |
| synchronize | false | false† | false |
| migrationsRun | false | false | false |

\*ajustable con `DB_ENCRYPT` / `DB_TRUST_SERVER_CERTIFICATE`.  
†suites unitarias pueden montar sqlite/`synchronize: true` aislado; no usan Railway.
