import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Habilitar CORS (soporta http://localhost:5173 y cualquier origen de desarrollo)
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Asegurar existencia de directorios de medios públicos
  const uploadDir = join(process.cwd(), 'uploads');
  ['galeria', 'comunicados', 'proyectos', 'transparencia'].forEach((sub) => {
    const subDir = join(uploadDir, sub);
    if (!existsSync(subDir)) {
      mkdirSync(subDir, { recursive: true });
    }
  });

  // Servir archivos estáticos en /uploads/ directamente fuera del prefijo /api/v1
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads/',
    setHeaders: (res: { setHeader(name: string, value: string): void }) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  // Exponer también bajo /api/v1/uploads/ por compatibilidad con clientes frontend
  app.useStaticAssets(uploadDir, {
    prefix: '/api/v1/uploads/',
    setHeaders: (res: { setHeader(name: string, value: string): void }) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
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

  const port = configService.get<number>('environment.port') || 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(
    `🚀 Servidor Backend SIGASJ corriendo en http://localhost:${port}/api/v1`,
  );
  logger.log(
    `📚 Documentación Swagger disponible en http://localhost:${port}/api/docs`,
  );
}
bootstrap().catch((err: unknown) => {
  console.error('Error al iniciar la aplicación SIGASJ:', err);
  process.exit(1);
});
