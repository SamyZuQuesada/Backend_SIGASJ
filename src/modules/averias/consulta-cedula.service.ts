import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

const HACIENDA_IDENTIFICACION_URL = 'https://api.hacienda.go.cr/fe/ae';

const TIPOS_IDENTIFICACION: Record<string, string> = {
  '01': 'Cédula física',
  '02': 'Cédula jurídica',
  '03': 'DIMEX',
  '04': 'NITE',
};

export type ConsultaCedulaResultado = {
  encontrada: boolean;
  identificacion: string;
  nombre: string | null;
  tipoIdentificacion: string | null;
};

type HaciendaIdentificacion = {
  nombre?: unknown;
  tipoIdentificacion?: unknown;
};

export const normalizarIdentificacion = (value: string): string =>
  value.replace(/\D/g, '');

export const identificacionConsultable = (digits: string): boolean =>
  digits.length >= 9 && digits.length <= 12;

@Injectable()
export class ConsultaCedulaService {
  private readonly logger = new Logger(ConsultaCedulaService.name);

  async consultar(identificacion: string): Promise<ConsultaCedulaResultado> {
    const digitos = normalizarIdentificacion(identificacion);
    if (!identificacionConsultable(digitos)) {
      throw new BadRequestException(
        'La cédula debe tener entre 9 y 12 dígitos.',
      );
    }

    let response: Response;
    try {
      response = await fetch(
        `${HACIENDA_IDENTIFICACION_URL}?identificacion=${encodeURIComponent(digitos)}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        },
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo consultar la identificación en Hacienda: ${
          error instanceof Error ? error.name : 'error'
        }`,
      );
      throw new BadGatewayException(
        'No fue posible consultar la cédula en este momento.',
      );
    }

    if (response.status === 400 || response.status === 404) {
      return this.noEncontrada(digitos);
    }

    if (!response.ok) {
      this.logger.warn(
        `Hacienda respondió ${response.status} al consultar una identificación.`,
      );
      throw new BadGatewayException(
        'No fue posible consultar la cédula en este momento.',
      );
    }

    const body = (await response.json().catch(() => null)) as
      | HaciendaIdentificacion
      | null;
    const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : '';
    if (!nombre) {
      return this.noEncontrada(digitos);
    }

    const tipoCodigo =
      typeof body?.tipoIdentificacion === 'string'
        ? body.tipoIdentificacion.trim()
        : '';

    return {
      encontrada: true,
      identificacion: digitos,
      nombre,
      tipoIdentificacion: TIPOS_IDENTIFICACION[tipoCodigo] ?? null,
    };
  }

  private noEncontrada(identificacion: string): ConsultaCedulaResultado {
    return {
      encontrada: false,
      identificacion,
      nombre: null,
      tipoIdentificacion: null,
    };
  }
}
