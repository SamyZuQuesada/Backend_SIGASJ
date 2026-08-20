import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { AcueductosCrService } from './acueductos-cr.service';

describe('AcueductosCrService', () => {
  let service: AcueductosCrService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'acueductosCr.baseUrl') return 'https://acueductoscr.com';
      if (key === 'acueductosCr.provincia') return 5;
      if (key === 'acueductosCr.acueducto') return 207;
      if (key === 'acueductosCr.timeout') return 5000;
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcueductosCrService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AcueductosCrService>(AcueductosCrService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe lanzar ServiceUnavailableException cuando la petición HTTP falla', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    await expect(service.consultarReciboRaw(130)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
