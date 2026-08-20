# Arquitectura del Backend - SIGASJ

**SIGASJ – Sistema de Gestión de la ASADA San Juan**  
*Santa Cruz, Guanacaste, Costa Rica*

---

## 1. Descripción General

El Backend de **SIGASJ** está diseñado bajo un enfoque de **Monolito Modular por Capas** en **NestJS** y **TypeScript**, utilizando **TypeORM** como ORM oficial para la gestión de la base de datos relacional.

La arquitectura garantiza:
- **Modularidad**: Funcionalidades aisladas por módulos de dominio.
- **Escalabilidad y Mantenibilidad**: Desarrollo progresivo alineado a la metodología Scrum (Features, Backlogs y Tasks).
- **Separación de Responsabilidades**: Flujo unidireccional de peticiones y datos.

---

## 2. Flujo de Datos

```text
Frontend React
      │
      │ HTTP / JSON (Prefijo: /api/v1)
      ▼
Controller
      │ (Valida DTO, aplica Guards y Roles)
      ▼
Service
      │ (Lógica de negocio, validaciones y transacciones)
      ▼
Repository / TypeORM
      │ (Consultas y persisistencia de Entities)
      ▼
Base de Datos Relacional
```

---

## 3. Estructura General del Proyecto

```text
src/
├── main.ts                     # Punto de entrada principal (Global prefix /api/v1, CORS, Swagger, ValidationPipe)
├── app.module.ts               # Módulo raíz (Importación de ConfigModule, TypeOrmModule y Módulos de Dominio)
│
├── config/                     # Configuración centralizada del sistema
│   ├── database.config.ts      # Configuración de TypeORM
│   ├── jwt.config.ts           # Configuración de tokens JWT
│   └── environment.config.ts   # Configuración de puerto y entorno
│
├── database/                   # Infraestructura de persistencia
│   ├── migrations/             # Migraciones de TypeORM para cambios de esquema
│   └── seeds/                  # Semillas iniciales de datos
│
├── common/                     # Elementos reutilizables transversales
│   ├── decorators/             # Decoradores personalizados (@Roles, @CurrentUser)
│   ├── guards/                 # Guards de seguridad (JwtAuthGuard, RolesGuard)
│   ├── enums/                  # Enums compartidos (Role)
│   ├── interfaces/             # Interfaces compartidas (JwtPayload)
│   ├── filters/                # Filtros de excepción personalizados
│   ├── interceptors/           # Interceptores HTTP
│   └── constants/              # Constantes globales
│
└── modules/                    # Módulos de Dominio
    ├── auth/                   # Autenticación, JWT y login
    ├── usuarios/               # Gestión de usuarios del sistema
    ├── contenido-publico/      # Contenido dinámico del Landing Page (Información, Contacto, Galería, Transparencia)
    ├── comunicados/            # Gestión independiente de comunicados (Públicos y Administrativos)
    ├── abonados/               # Gestión de abonados
    ├── averias/                # Reporte y seguimiento de averías
    ├── solicitudes/            # Solicitudes de servicios
    ├── lecturas/               # Lecturas de medidores
    ├── consumos/               # Gestión de consumos
    ├── inventario/             # Gestión de materiales e inventarios
    ├── actividades-fontanero/  # Registro de actividades de fontanería
    └── proyectos/              # Proyectos de infraestructura de la ASADA
```

---

## 4. Control de Acceso y Roles

El sistema utiliza autenticación basada en JWT y autorización granular mediante roles centralizados en el enum `Role`:

- **`ADMINISTRADORA`**: Acceso total al panel administrativo y configuraciones.
- **`SECRETARIA`**: Gestión administrativa de abonados, comunidacados, solicitudes y contenido público.
- **`FONTANERO`**: Registro de lecturas, actividades de campo y atención de averías.
- **`ABONADO`**: Consulta de consumos, reportes de averías y solicitudes públicas/privadas.

### Ejemplo de uso en Controladores:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
@Get()
findAll() {
  return this.service.findAll();
}
```

---

## 5. Endpoints de Contenido Público y Landing Page

El Landing Page en React consume información pública sin requerir token JWT:

- `GET /api/v1/public/informacion`
- `GET /api/v1/public/contacto`
- `GET /api/v1/public/galeria`
- `GET /api/v1/public/transparencia`
- `GET /api/v1/public/comunicados`

La modificación de este contenido se realiza mediante el panel administrativo utilizando rutas protegidas bajo `/api/v1/admin/*`.

### Galería de fotografías

- `GET /api/v1/public/galeria` — fotos activas (formato landing: `imageUrl`, `altText`, `title`, `description`)
- `GET /api/v1/admin/galeria` — listado admin con filtros opcionales `titulo`, `activo`
- `GET /api/v1/admin/galeria/:id` — detalle admin
- `POST /api/v1/admin/galeria` — crear con `multipart/form-data` (campo `imagen`)
- `PATCH /api/v1/admin/galeria/:id` — actualizar metadatos e imagen opcional
- `PATCH /api/v1/admin/galeria/:id/activo` — activar/desactivar
- `DELETE /api/v1/admin/galeria/:id` — eliminar foto y archivo asociado

Persistencia: entidad TypeORM `GaleriaFoto` + migración `1724126400000-CreateGaleriaFoto`.
Archivos locales en `uploads/galeria/` servidos bajo `/uploads/*`.

---

## 6. Documentación Swagger / OpenAPI

La documentación interactiva de la API está configurada en la ruta:

```text
http://localhost:3000/api/docs
```

Permite probar endpoints, visualizar esquemas DTO y utilizar autenticación Bearer JWT.

---

## 7. Variables de Entorno (.env)

Copie el archivo `.env.example` a `.env` y ajuste las variables según el entorno:

```env
PORT=3000
NODE_ENV=development

DB_TYPE=mssql
DB_HOST=localhost
DB_PORT=1434
DB_USERNAME=sa
DB_PASSWORD=Sigasj_Dev2026!
DB_DATABASE=SIGASJ

JWT_SECRET=super_secret_jwt_key_sigasj_2026
JWT_EXPIRES_IN=24h
```
