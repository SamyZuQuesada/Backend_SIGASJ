# Seguridad Backend SIGASJ en Render

Alcance: secretos de producción, JWT existente, guards/roles, CORS allowlist, logs, rotación.
Fuera de alcance: AuthModule nuevo, roles nuevos, refresh token (no existe), SQL Server (11.4), secretos `VITE_*`.

## Auth actual (sin rehacer)

| Ítem | Valor |
| --- | --- |
| Estrategia | Passport JWT (`JwtStrategy`) |
| Extracción | `Authorization: Bearer` |
| Guard | `JwtAuthGuard` |
| Roles | `RolesGuard` + `@Roles(...)` |
| Roles reales | `ADMINISTRADORA`, `SECRETARIA`, `FONTANERO`, `ABONADO`, `AYUDANTE` |
| Access token | `JWT_SECRET` + `JWT_EXPIRES_IN` (default `24h`) |
| Refresh token | **No existe** |
| Cookies de sesión | **No existen** (Bearer only; frontend usa `localStorage`) |
| Login | `POST /api/v1/auth/login` → `{ accessToken, user }` sin `passwordHash` |
| Payload JWT | `sub`, `email`, `role`, `name` |

## Variables de seguridad (nombres; sin valores)

| Variable | Uso | Obligatoria prod | Secreta |
| --- | --- | --- | --- |
| `JWT_SECRET` | Firma/verificación access JWT | Sí | Sí |
| `JWT_EXPIRES_IN` | Vigencia access (default `24h`) | No | No |
| `NODE_ENV` | `production` en Render | Recomendada | No |
| `FRONTEND_URL` | Origen CORS principal (Vercel real) | Sí (o alternativas) | No |
| `FRONTEND_BASE_URL` | Correos + CORS | Alternativa | No |
| `CORS_ALLOWED_ORIGINS` | Orígenes CSV adicionales | Alternativa | No |
| `AUTH_REQUIRE_PASSWORD` | Fuerza bcrypt también en local | No | No |
| `DB_PASSWORD` / SMTP / Infobip / Jotform | Otros secretos | Según módulo | Sí |

No existe `JWT_REFRESH_SECRET` en este proyecto.

En producción, `assertProductionSecrets()` falla el arranque si falta `JWT_SECRET` fuerte o un origen frontend.

## CORS

- Allowlist explícita vía `createCorsOriginDelegate` (sin `origin: '*'` / `origin: true` en API).
- `credentials: false` (auth por Bearer, no cookies).
- Métodos: GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS.
- Headers: Content-Type, Authorization, Accept.
- Localhost solo en entornos no productivos.
- **URL Vercel:** no está hardcodeada ni inventada. Debe configurarse en Render como `FRONTEND_URL` con el dominio real autorizado cuando exista (dependencia del backlog).

## Cookies / trust proxy

No aplica a la sesión JWT actual. No se activó `trust proxy` a ciegas: Render termina TLS, pero sin cookies Secure/SameSite dependientes de `req.secure` no es necesario para este backlog.

## Rotación de `JWT_SECRET`

1. Generar una clave criptográficamente fuerte (p. ej. `openssl rand -base64 48` o `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`).
2. Actualizar `JWT_SECRET` en Render → Environment (secret).
3. Guardar y reiniciar / redeploy el Web Service.
4. Impacto: **todos los access tokens firmados con la clave anterior dejan de validarse** (401 hasta nuevo login).
5. Verificar `POST /auth/login` y una ruta protegida con el nuevo token.
6. Retirar/olvidar la clave anterior; no versionarla.

No hay rotación de refresh: el sistema no usa refresh token.

## SECURITY ISSUE — secretos expuestos históricamente

Hallazgos (nombres/ubicaciones; **sin valores**):

| Ubicación | Riesgo |
| --- | --- |
| Historial Git / `ARCHITECTURE.md` | Placeholder `JWT_SECRET` de desarrollo documentado |
| Historial Git / `.env.example` (versiones previas) | Placeholder JWT + `DB_PASSWORD` de ejemplo |
| Specs de test | Usan el placeholder de desarrollo como secreto de prueba local |

Borrar del working tree **no** limpia el historial. Rotar `JWT_SECRET` (y `DB_PASSWORD` real si alguna vez coincidió con el ejemplo) en Render/SQL. No reescribir historial Git sin autorización explícita.

## Criterio 401 vs 403

- Sin autenticación / JWT inválido / expirado / firma incorrecta → **401**.
- Autenticado sin rol permitido → **403**.
- Ocultar botones en React **no** es control de acceso.

## Matriz de secretos (sin valores)

| Variable | Tipo | Secreta | Render | GitHub | Logs | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| `JWT_SECRET` | Auth | Sí | Debe estar (rotada) | No versionar valor | No | Producción sin fallback |
| `JWT_EXPIRES_IN` | Auth | No | Opcional (`24h`) | Placeholder OK | No | Mantener `24h` |
| `FRONTEND_URL` | CORS | No | Pendiente URL Vercel real | Placeholder vacío | No | Obligatoria en prod |
| `NODE_ENV` | Runtime | No | `production` | `development` en example | No | Guards no dependen solo de esto |

## Matriz JWT (esperado; ver tests)

| Caso | Token | Resultado esperado |
| --- | --- | --- |
| Ausente | — | 401 |
| Inválido / malformado | `Bearer invalid-token` | 401 |
| Expirado | JWT con `exp` pasado | 401 |
| Firma incorrecta | Firmado con otra clave | 401 |
| Válido + rol OK | Access actual | Continúa (no 401/403 de authz) |

Cubierto por `solicitudes-admin-seguridad.spec.ts`, `roles.guard.spec.ts`, `auth.spec.ts`.

## Matriz CORS

| Origin | Permitido | Credentials | Notas |
| --- | --- | --- | --- |
| `FRONTEND_URL` (Vercel real) | Sí, cuando se configure | false | Dependencia: URL no inventada |
| `http://localhost:5173` | Solo no-prod | false | Dev Vite |
| `https://example.com` | No | false | Sin ACAO |

## Matriz cookies

N/A — no hay cookies de sesión JWT.

## Render — variables por nombre

Web Service `sigasj-api` (`srv-dbikundg1s2s73dhud80`) ya declara por nombre:

- `JWT_SECRET` → CONFIGURADO EN RENDER (no revelar valor).
- `JWT_EXPIRES_IN`
- `NODE_ENV`
- `NODE_VERSION`

Pendiente en Dashboard (manual; no automatizar si el UI expone secretos en capturas):

1. Rotar `JWT_SECRET` con `openssl rand -base64 48` (o equivalente) si aún coincide con el placeholder histórico de desarrollo.
2. Confirmar `NODE_ENV=production`.
3. Añadir `FRONTEND_URL` = origen HTTPS real del Frontend (Vercel o temporal autorizada; **no inventar**).
4. Guardar / reiniciar el servicio tras desplegar el código de allowlist CORS.

## Dependencias pendientes

- **URL Vercel (o temporal autorizada)** para `FRONTEND_URL` / CORS de producción.
- **11.4 SQL Server**: el servicio no permanece Live sin DB; limita smoke HTTPS en Render.
- Deploy del código de seguridad (rama actual) cuando el equipo autorice commit/push (este backlog: no commit/push).
