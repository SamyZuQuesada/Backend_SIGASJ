import { Test, TestingModule } from '@nestjs/testing';
import { RecibosService } from './recibos.service';
import { AcueductosCrService } from './acueductos-cr.service';

describe('RecibosService', () => {
  let service: RecibosService;
  let acueductosCrService: AcueductosCrService;

  const mockAcueductosCrService = {
    consultarReciboRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecibosService,
        {
          provide: AcueductosCrService,
          useValue: mockAcueductosCrService,
        },
      ],
    }).compile();

    service = module.get<RecibosService>(RecibosService);
    acueductosCrService = module.get<AcueductosCrService>(AcueductosCrService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe consultar y parsear correctamente un recibo sin deuda', async () => {
    const mockRawHtml = `
      <span id="MainContent_lblMensaje">No existen recibos pendientes para el abonado: MARCO ANTONIO CABALCETA JIMENEZ</span>
    `;

    mockAcueductosCrService.consultarReciboRaw.mockResolvedValue(mockRawHtml);

    const result = await service.consultarRecibo(130);

    expect(result.success).toBe(true);
    expect(result.data?.numeroPaja).toBe(130);
    expect(result.data?.abonado).toBe('MARCO ANTONIO CABALCETA JIMENEZ');
    expect(result.data?.tieneRecibosPendientes).toBe(false);
    expect(mockAcueductosCrService.consultarReciboRaw).toHaveBeenCalledWith(130);
  });
});
