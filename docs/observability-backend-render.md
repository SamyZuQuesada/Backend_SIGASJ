# Observabilidad Backend SIGASJ (Render)

Alcance: health de proceso, Health Check de Render, logs operativos, request ID, sanitización.
Fuera de alcance: Grafana, Prometheus, Datadog, Sentry, OpenTelemetry completo, dashboards de negocio.

## Health (liveness)

| Ítem | Valor |
| --- | --- |
| Ruta oficial | `GET /api/v1/health` |
| Alias | `GET /api/v1` (mismo cuerpo) |
| Auth | **Pública** (sin JWT) |
| HTTP saludable | **200** |
| Cuerpo | `{ "status": "ok" }` |
| Dependencias | **No** consulta SQL Server |

Prefijo global: `api/v1` (`main.ts`). Render Health Check Path: **`/api/v1/health`** (`render.yaml`).

Process health ≠ database health. Si TypeORM impide el bootstrap, Nest no arranca y `/health` no existe.

## Render

| Elemento | Valor |
| --- | --- |
| Web Service | `sigasj-api` |
| URL HTTPS | `https://sigasj-api.onrender.com` |
| Health Check Path | `/api/v1/health` |
| Logs | Dashboard → servicio → **Logs** |
| Restart | **Manual Deploy** / restart del servicio |

### Diagnóstico básico

1. `GET https://sigasj-api.onrender.com/api/v1/health` → esperar `200` + `{ "status": "ok" }`.
2. Si no responde: estado del Web Service (Deploy failed / Live / restart).
3. Runtime logs: buscar `SIGASJ listo` (startup) o `Fallo de arranque`.
4. Buscar `requestId=` en líneas de error.
5. Si health 200 pero una operación falla: revisar dependencia (p. ej. SQL 11.4), no asumir caída del proceso.
6. Health 404: path/prefix incorrecto (¿olvidó `/api/v1`?).
7. 502/503: proceso arrancando, crash loop o plataforma; cruzar con logs.

### Reinicio controlado

1. Restart/Redeploy en Render.
2. Health deja de responder temporalmente.
3. Log: build/start → `SIGASJ listo … health=/api/v1/health`.
4. Health vuelve a 200.
5. Probar un endpoint real existente (no crear `/crash`).

## Logging

| Evento | Nivel | Incluye | Prohibido |
| --- | --- | --- | --- |
| Startup | log/warn | env, puerto, ruta health | `process.env`, secretos |
| Request OK | log | method, path, status, ms, requestId | body, Authorization, cookies |
| 4xx | warn | igual | credenciales / PII |
| 5xx | error | igual + nombre de excepción | stack al cliente; JWT; password |
| `/health` | (silencio) | — | no spamear info por polling |
| Fallo arranque | error | nombre + mensaje sanitizado | connection string / password |

Logger: NestJS `Logger`. Exception filter: `HttpExceptionFilter` (sin stack al cliente en 5xx).

### Request ID

- Header: `X-Request-Id`
- Generado por servidor (UUID) o aceptado si es seguro (8–128 chars `[A-Za-z0-9._-]`)
- Aparece en logs HTTP y en errores del filter
- Devuelto en la respuesta

## Matrices

### Health

| Caso | HTTP | Render puede verificar |
| --- | --- | --- |
| NestJS disponible | 200 | Sí |
| Sin token | 200 | Sí |
| Token inválido | 200 | Sí |
| Reiniciando / bootstrap | N/A o 502/503 | Temporal |
| Ruta incorrecta | 404 | Path mal configurado |

### Datos sensibles

| Dato | En log | En health |
| --- | --- | --- |
| JWT / refresh / Authorization / cookie | No | No |
| Password / connection string | No | No |
| Host/usuario SQL | No | No |
| PII (email, cédula, teléfono) | No por defecto | No |
