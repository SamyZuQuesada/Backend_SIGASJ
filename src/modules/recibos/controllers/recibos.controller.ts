import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RecibosService } from '../services/recibos.service';
import { ConsultarReciboDto } from '../dto/consultar-recibo.dto';
import { ReciboConsultaResponseDto } from '../dto/recibo-consulta-response.dto';
import { RecibosRateLimiterGuard } from '../guards/recibos-rate-limiter.guard';

@ApiTags('Recibos (Consulta Pública)')
@Controller('public/recibos')
export class RecibosController {
  constructor(private readonly recibosService: RecibosService) {}

  @Get(':numeroPaja')
  @UseGuards(RecibosRateLimiterGuard)
  @ApiOperation({
    summary: 'Consultar estado del recibo de agua de forma pública (Landing Page)',
    description:
      'Permite a cualquier visitante ingresar su número de paja y obtener la información de su recibo consumida en tiempo real desde AcueductosCR sin necesidad de autenticación.',
  })
  @ApiParam({
    name: 'numeroPaja',
    description: 'Número de paja o medidor del abonado (debe ser entero > 0)',
    example: 130,
  })
  @ApiResponse({
    status: 200,
    description: 'Consulta procesada exitosamente',
    type: ReciboConsultaResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Número de paja inválido (debe ser mayor a 0)',
  })
  @ApiResponse({
    status: 404,
    description: 'La paja consultada no existe en el sistema de AcueductosCR',
  })
  @ApiResponse({
    status: 429,
    description: 'Demasiadas solicitudes desde esta dirección IP (Rate Limiting)',
  })
  @ApiResponse({
    status: 503,
    description: 'El servicio externo de AcueductosCR no está disponible temporalmente',
  })
  async consultarRecibo(
    @Param() params: ConsultarReciboDto,
  ): Promise<ReciboConsultaResponseDto> {
    return this.recibosService.consultarRecibo(params.numeroPaja);
  }
}
