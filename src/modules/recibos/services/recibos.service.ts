import { Injectable, Logger } from '@nestjs/common';
import { AcueductosCrService } from './acueductos-cr.service';
import { AcueductosCrParser } from '../parsers/acueductos-cr.parser';
import { ReciboConsultaResponseDto } from '../dto/recibo-consulta-response.dto';

@Injectable()
export class RecibosService {
  private readonly logger = new Logger(RecibosService.name);
  private readonly parser = new AcueductosCrParser();

  constructor(private readonly acueductosCrService: AcueductosCrService) {}

  /**
   * Consulta pública de recibo de agua para un abonado mediante su número de paja.
   * Sin registrar PII (números de paja, nombres ni montos) en los logs técnicos.
   */
  async consultarRecibo(numeroPaja: number): Promise<ReciboConsultaResponseDto> {
    this.logger.log('Procesando solicitud de consulta pública de recibo de agua');

    const rawResponse = await this.acueductosCrService.consultarReciboRaw(numeroPaja);
    const result = this.parser.parseResponse(rawResponse, numeroPaja);

    this.logger.log('Consulta pública de recibo completada exitosamente');

    return result;
  }
}
