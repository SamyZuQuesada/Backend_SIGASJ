import './common/time/forzar-zona-utc';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import {
  CORS_ALLOWED_HEADERS,
  CORS_METHODS,
  createCorsOriginDelegate,
} from './config/cors-origin';
import { assertProductionSecrets } from './config/production-secrets';

async function bootstrap() {
  assertProductionSecrets();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // CORS allowlist (FRONTEND_URL / FRONTEND_BASE_URL / CORS_ALLOWED_ORIGINS).
  // Auth es Bearer (localStorage); no cookies de sesión → credentials: false.
  app.enableCors({
    origin: createCorsOriginDelegate(),
    methods: [...CORS_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    credentials: false,
  });

  // Asegurar existencia de directorios de medios públicos
  const uploadDir = join(process.cwd(), 'uploads');
  [
    'galeria',
    'comunicados',
    'proyectos',
    'transparencia',
    'formularios-oficiales',
    'formularios-descargables',
  ].forEach((sub) => {
    const subDir = join(uploadDir, sub);
    if (!existsSync(subDir)) {
      mkdirSync(subDir, { recursive: true });
    }
  });

  // Estáticos: CORP cross-origin; ACAO lo define enableCors (allowlist), no wildcard.
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads/',
    setHeaders: (res: { setHeader(name: string, value: string): void }) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  app.useStaticAssets(uploadDir, {
    prefix: '/api/v1/uploads/',
    setHeaders: (res: { setHeader(name: string, value: string): void }) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  // Compatibilidad de alias para endpoints sin versión (ej: /api/asociados -> /api/v1/asociados)
  app.use((req: any, _res: any, next: any) => {
    if (
      req.url === '/api/asociados' ||
      req.url.startsWith('/api/asociados/') ||
      req.url.startsWith('/api/asociados?')
    ) {
      req.url = req.url.replace('/api/asociados', '/api/v1/asociados');
    }
    next();
  });

  // Prefijo global de API
  app.setGlobalPrefix('api/v1');

  // Pipe de validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Configuración de Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SIGASJ API')
    .setDescription(
      'Documentación oficial de la API del Sistema de Gestión de la ASADA San Juan',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingrese su token JWT de autenticación',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Render inyecta PORT; fallback local 3000. Escucha en 0.0.0.0 (no solo localhost).
  const port = configService.get<number>('environment.port') || 3000;
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (configService.get<boolean>('auth.devLoginWithoutPassword') === true) {
    logger.warn(
      'Modo desarrollo: POST /auth/login no valida contraseña (AUTH_REQUIRE_PASSWORD=true para exigirla).',
    );
  }
  logger.log(
    `SIGASJ listo env=${nodeEnv} bind=0.0.0.0:${port} health=/api/v1/health`,
  );
  logger.log(`Swagger: http://localhost:${port}/api/docs`);
}
bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  const name = err instanceof Error ? err.name : 'Error';
  const message = err instanceof Error ? err.message : String(err);
  logger.error(
    `Fallo de arranque ${name}: ${message.replace(/Password\s*=\s*\S+/gi, 'Password=***')}`,
  );
  process.exit(1);
});
