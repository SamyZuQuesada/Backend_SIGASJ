# Operación de SIGASJ en producción

Fecha de esta revisión: 2026-11-16, con `main` publicado.  
Sitio: `https://sigasj-frontend.vercel.app`  
API: `https://sigasj-api.onrender.com`  
Base: Azure SQL `sigasj-dev` (el usuario de la aplicación no puede crear tablas).

Los documentos `deploy-render-backend.md` y `smoke-test-render.md` describen corridas anteriores. El procedimiento vigente es este.

## Qué está publicado

| Pieza | Dónde | Qué salió | Notas |
| --- | --- | --- | --- |
| Frontend | Vercel, proyecto `sigasj-frontend` | `6b94ee2` de `main` | El proyecto no está conectado a Git. Un push no publica solo. Production se publicó con la CLI desde la raíz del frontend. Bundle `index-BwRoeWqu.js`. `VITE_API_URL=https://sigasj-api.onrender.com/api/v1`, horneada en el build. |
| API | Render, servicio `sigasj-api` | `c27d406` de `main` | Plan Free. Se duerme y el primer request puede tardar más de un minuto. El arranque detectó `dbo.ArchivoMedia`. |
| Datos | Azure SQL | — | `migrationsRun` está en false. La tabla de archivos ya existe; el usuario de la aplicación no crea tablas. |

El login publicado pide correo y contraseña. Las tres cuentas de la ASADA (administradora, secretaria y fontanero) entran con la clave que la aplicación ya alinea en producción.

## Actualizar

1. Integrar el cambio en `main` de cada repositorio. No publicar una rama de trabajo.
2. Frontend y API se despliegan juntos cuando el contrato de login cambia. El `main` actual del frontend pide correo y contraseña y llama `POST /api/v1/auth/login` y `GET /api/v1/auth/me`.
3. Vercel: el proyecto no tiene repositorio Git conectado, así que un push no publica solo. Publicar Production con la CLI desde la raíz del frontend (`vercel deploy --prod`). Si cambió `VITE_API_URL`, el build tiene que ser nuevo: esa variable se hornea.
4. Render: si el auto-deploy no toma el commit, Manual Deploy → Deploy latest commit. No usar Clear build cache salvo que el build esté corrupto.
5. No guardar el formulario de Environment si un secreto aparece vacío. Eso borra `DB_PASSWORD` o `JWT_SECRET`.
6. Esperar `GET /api/v1/health` → `{"status":"ok"}` y el encabezado `access-control-allow-origin: https://sigasj-frontend.vercel.app`.

## Revertir

1. Render → Deploys → Rollback del deploy anterior que figure como Live. No hace falta un commit nuevo.
2. Vercel → Deployments → el deployment anterior en Production → Promote to Production.
3. Volver a pedir `/api/v1/health` y abrir la landing. Un rollback de la API invalida los JWT si el `JWT_SECRET` cambió; si no cambió, las sesiones siguen valiendo.
4. No revertir la base con `down` de migraciones en producción sin una copia. Los datos de asociados, averías y solicitudes no se tocan al revertir el proceso.

## Archivos y PDF

Render no conserva el disco. Las fotos y los PDF sobreviven en `dbo.ArchivoMedia`.

El 2026-11-16 el arranque del API en `c27d406` registró la tabla lista. El usuario `sigasj_app` sigue sin permiso de `CREATE TABLE`; si la tabla se borra, hay que recrearla con un usuario que sí pueda y reiniciar el API. La migración vigente es `1724686410000-CreateArchivoMediaTable` e incluye `tamanoBytes`, `createdAt` y `updatedAt`.

Comprobado ese día: las cinco fotos de la galería, dos ilustraciones de comunicados, la portada del proyecto y el PDF de arreglo de pago responden 200 con bytes reales.

## Comprobación mínima antes de dar el sitio por abierto

| Prueba | Esperado |
| --- | --- |
| Landing Vercel | HTTP 200 y el JS apunta a `https://sigasj-api.onrender.com/api/v1` |
| `GET /api/v1/health` con `Origin` de Vercel | 200, cuerpo `{"status":"ok"}`, CORS de ese origen, `x-request-id` |
| `GET /api/v1/public/comunicados`, proyectos, galería, transparencia, contacto | 200 y filas reales de Azure SQL |
| Login con clave incorrecta | 401, sin `passwordHash` |
| `GET /api/v1/usuarios` sin token y con token inválido | 401 |
| Administradora y secretaria en `/api/v1/usuarios` | 200 |
| Fontanero en `/api/v1/usuarios` y en `/api/v1/admin/proyectos` | 403 |
| Administradora en `/api/v1/admin/proyectos` | 200 |
| Origen distinto de Vercel | la respuesta no repite ese origen en `access-control-allow-origin` |

## Resultado

Login, roles y módulos se comprobaron el 2026-11-13 sobre el API que ya estaba en producción. Landing, archivos, health y recuperación se volvieron a comprobar el 2026-11-16 sobre `c27d406` y `6b94ee2`.

| Prueba | Resultado |
| --- | --- |
| Landing y bundle hacia Render | PASS el 2026-11-16. Bundle `index-BwRoeWqu.js`. La landing abre comunicados, trámites, galería y el asistente. El login pide correo y contraseña. |
| Health, CORS del origen Vercel y `x-request-id` | PASS. Un origen ajeno no se refleja en `access-control-allow-origin`. |
| Login y roles | PASS. Las tres cuentas entran con su rol y la respuesta no trae `passwordHash`. Clave incorrecta, sin token y token inválido responden 401. Fontanero en usuarios y en proyectos de administración: 403. Secretaria en proyectos de administración: 403. `GET /api/v1/auth/me` de la administradora: 200. |
| Módulos | PASS de lectura. Públicos: comunicados 4, proyectos 1, galería 5, transparencia, contacto e información. Administración: inventario (4 materiales, 1 categoría, 4 proveedores, 10 movimientos, 1 alerta), asociados 3, averías 6, actividades 4, recursos humanos (1 colaborador, 6 puestos, 2 permisos, 2 solicitudes de ausencia), solicitudes 6 y 6 formularios oficiales. Fontanero: 4 averías, 4 actividades, 5 tipos, 2 ausencias, 5 solicitudes de materiales y saldo de vacaciones. Las pantallas de inventario, recursos humanos, trámites, averías del fontanero, registro de actividades y sus solicitudes abrieron con esos datos. La administradora no entra a las rutas del fontanero. |
| Archivos persistentes | PASS el 2026-11-16. `dbo.ArchivoMedia` está lista. Galería, comunicados, portada de proyecto y el PDF oficial de arreglo de pago se sirven desde el API. |
| Recuperación | Confirmado el 2026-11-16 sin bajar el sitio. En Render el deploy vivo es `c27d406` y el anterior, `66bb978`, queda como destino de Rollback. En Vercel el Production anterior sigue en Ready y se puede promover. No se pulsó ninguna de las dos. |
| Puesta en producción | Hecha con `main` actual. API `c27d406` y frontend `6b94ee2`. |
