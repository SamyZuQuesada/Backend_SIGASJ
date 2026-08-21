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

  it('GET / informa que la API está operativa', () => {
    expect(appController.getHealth()).toEqual({
      name: 'SIGASJ API',
      status: 'ok',
      message: 'Sistema de Gestión de la ASADA San Juan',
      version: '1.0.0',
    });
  });

  it('GET /health expone el mismo estado', () => {
    expect(appController.getHealthAlias()).toEqual(appController.getHealth());
  });
});
