# Preparación de producción — backend (PBI 11.1)

## Cómo se construye

- Carpeta: raíz del repo `Backend_SIGASJ`
- Node.js: `>=22.12.0 <23` (ver `.nvmrc`)
- Gestor: npm
- Instalación: `npm ci` (o `npm install`)
- Compilación: `npm run build` (`nest build`) → `dist/`
- Arranque del artefacto: `npm run start:prod` (`node dist/main`)
- Migraciones (nunca `synchronize`): `npm run migration:run`
- Escucha: `HOST` (por defecto `0.0.0.0`) y `PORT` (por defecto `3000`)

TypeORM tiene `synchronize: false`. El esquema de producción solo cambia con migraciones.

## Variables

Secretos (nunca en el frontend ni en Git): `DB_PASSWORD`, `JWT_SECRET`, `MAIL_PASSWORD`, `INFOBIP_API_KEY`, `JOTFORM_API_KEY`, `JOTFORM_WEBHOOK_SECRET`.

Obligatorias con `NODE_ENV=production`:

- `JWT_SECRET` distinto del ejemplo de desarrollo
- `DB_TYPE`, `DB_HOST`, `DB_DATABASE`
- `DB_USERNAME` y `DB_PASSWORD` si no usa `DB_TRUSTED_CONNECTION=true`
- `CORS_ORIGINS` o `FRONTEND_BASE_URL`

En producción SQL Server cifra TLS salvo `DB_ENCRYPT=false`. El login sin contraseña (`AUTH_REQUIRE_PASSWORD`) solo aplica en `development`.

Archivos locales persistentes (no van a Git): `/uploads`, `/data`. En Render hay que montar disco o un almacén externo (tarea 11.5.4).

## Hallazgos que pueden bloquear el despliegue

- Driver nativo `msnodesqlv8` + ODBC 17 en Windows local. En Linux (Render) el cliente `mssql`/tedious suele bastar con usuario y contraseña SQL, **sin** trusted connection.
- CORS abierto en desarrollo (`origin: true`). En producción se limita a `CORS_ORIGINS` / `FRONTEND_BASE_URL`.
- Swagger queda en `/api/docs`; conviene no indexarlo públicamente (fuera de 11.1).
- `.env.example` anterior incluía contraseña y JWT de ejemplo con pinta de valor real. Se sustituyó por placeholders vacíos.

## GitHub y versión a publicar

- Repo: `SamyZuQuesada/Backend_SIGASJ`
- Rama de integración: `main`
- Root de Render: `/` (este repositorio)
- Registrar el SHA de `main` que se publique (`git rev-parse HEAD` en el commit desplegado)
- Responsable de fusionar a `main`: revisión del equipo; no publicar secretos

## Evidencia de esta pasada

`npx nest build` termina en `dist/`. Arranque local: `npm run start:prod` con un `.env` válido (no versionado).
