import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../../common/filters/http-exception.filter';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../../config/jwt.config';
import { AuthModule } from '../../auth/auth.module';
import { AsociadosModule } from '../asociados.module';
import { Asociado } from '../entities/asociado.entity';

export const ASOCIADOS_URL = '/api/v1/asociados';

export type AsociadosTestApp = {
  app: INestApplication<App>;
  asociadoRepository: Repository<Asociado>;
  signAs: (role: Role) => string;
};

/** App Nest con base SQL.js en memoria y la misma configuración de main.ts. */
export async function crearAsociadosTestApp(): Promise<AsociadosTestApp> {
  const moduleFixture = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
      TypeOrmModule.forRoot({
        type: 'sqljs',
        autoSave: false,
        dropSchema: true,
        entities: [Asociado],
        synchronize: true,
      }),
      AuthModule,
      AsociadosModule,
    ],
    providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
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

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  const jwtService = moduleFixture.get(JwtService);
  const asociadoRepository = moduleFixture.get<Repository<Asociado>>(
    getRepositoryToken(Asociado),
  );

  const signAs = (role: Role) => {
    const payload: JwtPayload = {
      sub: '1',
      email: `${role.toLowerCase()}@asadasanjuan.cr`,
      role,
      name: `Usuario ${role}`,
    };
    return jwtService.sign(payload);
  };

  return { app, asociadoRepository, signAs };
}
