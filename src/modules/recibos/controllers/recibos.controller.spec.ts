import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RecibosController } from './recibos.controller';
import { RecibosService } from '../services/recibos.service';
import { RecibosRateLimiterGuard } from '../guards/recibos-rate-limiter.guard';

describe('RecibosController', () => {
  let controller: RecibosController;

  const mockRecibosService = {
    consultarRecibo: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'acueductosCr.rateLimitWindowMs') return 60000;
      if (key === 'acueductosCr.rateLimitMax') return 10;
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecibosController],
      providers: [
        {
          provide: RecibosService,
          useValue: mockRecibosService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        RecibosRateLimiterGuard,
      ],
    }).compile();

    controller = module.get<RecibosController>(RecibosController);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('debe retornar la respuesta del servicio al consultar una paja válida', async () => {
    const expectedResponse = {
      success: true,
      data: {
        numeroPaja: 130,
        abonado: 'MARCO ANTONIO CABALCETA JIMENEZ',
        tieneRecibosPendientes: false,
        recibos: [],
      },
    };

    mockRecibosService.consultarRecibo.mockResolvedValue(expectedResponse);

    const result = await controller.consultarRecibo({ numeroPaja: 130 });

    expect(result).toEqual(expectedResponse);
    expect(mockRecibosService.consultarRecibo).toHaveBeenCalledWith(130);
  });
});
