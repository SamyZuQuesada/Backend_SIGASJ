import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { TiposSolicitudService } from './tipos-solicitud.service';

@ApiTags('Tipos de Solicitud')
@Controller('solicitudes/tipos')
export class TiposSolicitudController {
  constructor(private readonly tiposSolicitudService: TiposSolicitudService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar tipos de solicitudes oficiales activos',
    description:
      'Devuelve el catálogo de trámites oficiales disponibles para los ciudadanos en el portal de la ASADA.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de trámites oficiales activos',
    type: [TipoSolicitud],
  })
  findActivos(): Promise<TipoSolicitud[]> {
    return this.tiposSolicitudService.findActivos();
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Consultar tipo de solicitud por su slug descriptivo',
    description:
      'Permite cargar la configuración y metadatos de un trámite oficial a partir de la ruta (e.g., /solicitudes/arreglo-pago).',
  })
  @ApiResponse({
    status: 200,
    description: 'Información del trámite oficial',
    type: TipoSolicitud,
  })
  @ApiResponse({
    status: 404,
    description: 'Tipo de solicitud no encontrado',
  })
  findBySlug(@Param('slug') slug: string): Promise<TipoSolicitud> {
    return this.tiposSolicitudService.findBySlug(slug);
  }
}
