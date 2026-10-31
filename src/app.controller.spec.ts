import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController — salud de SIGASJ', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('GET / responde liveness mínimo', () => {
    expect(appController.getHealth()).toEqual({ status: 'ok' });
  });

  it('GET /health expone el mismo estado', () => {
    expect(appController.getHealthAlias()).toEqual(appController.getHealth());
  });

  it('health no incluye secretos ni metadatos internos', () => {
    const body = JSON.stringify(appController.getHealth());
    expect(body).not.toMatch(/password|jwt|secret|host|sql|database/i);
    expect(body).not.toContain('SIGASJ API');
  });
});
