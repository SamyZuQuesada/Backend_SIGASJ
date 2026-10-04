import { BadRequestException } from '@nestjs/common';
import {
  ConsultaCedulaService,
  identificacionConsultable,
  normalizarIdentificacion,
} from './consulta-cedula.service';

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe('ConsultaCedulaService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('normaliza guiones y espacios', () => {
    expect(normalizarIdentificacion(' 1-2345-6789 ')).toBe('123456789');
    expect(identificacionConsultable('123456789')).toBe(true);
    expect(identificacionConsultable('12345678')).toBe(false);
  });

  it('devuelve el nombre público cuando Hacienda lo encuentra', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        nombre: 'MARIA RODRIGUEZ SOLIS',
        tipoIdentificacion: '01',
        situacion: { moroso: 'NO' },
      }),
    ) as typeof fetch;

    const result = await new ConsultaCedulaService().consultar('1-2345-6789');

    expect(result).toEqual({
      encontrada: true,
      identificacion: '123456789',
      nombre: 'MARIA RODRIGUEZ SOLIS',
      tipoIdentificacion: 'Cédula física',
    });
    expect(JSON.stringify(result)).not.toContain('moroso');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.hacienda.go.cr/fe/ae?identificacion=123456789',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      }),
    );
  });

  it('indica que no hay registro cuando Hacienda responde 404', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(404, { message: 'no' })) as typeof fetch;

    await expect(
      new ConsultaCedulaService().consultar('123456789'),
    ).resolves.toEqual({
      encontrada: false,
      identificacion: '123456789',
      nombre: null,
      tipoIdentificacion: null,
    });
  });

  it('rechaza una cédula demasiado corta', async () => {
    global.fetch = jest.fn() as typeof fetch;

    await expect(new ConsultaCedulaService().consultar('123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
