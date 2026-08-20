import { config as loadEnv } from 'dotenv';

loadEnv({ override: true });
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const uploadsRoot = configService.get<string>('environment.uploadsRoot')!;

  app.useStaticAssets(join(process.cwd(), uploadsRoot), {
    prefix: '/uploads/',
  });

  // Prefijo global de API
  app.setGlobalPrefix('api/v1');

  // Habilitar CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Pipe de validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
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
