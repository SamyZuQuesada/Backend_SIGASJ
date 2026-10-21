import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSolicitudArregloPagoDto } from './dto/create-solicitud-arreglo-pago.dto';
import { QuerySolicitudesDto } from './dto/query-solicitudes.dto';
import { SolicitudesAprobadaPendientesResponseDto } from './dto/solicitudes-aprobada-pendientes-response.dto';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudesService } from './solicitudes.service';

@ApiTags('Solicitudes')
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post('arreglo-pago')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Registrar nueva solicitud digital de Arreglo de Pago Domiciliar (Público)',
    description:
      'Recibe los datos oficiales del formulario digital, valida el plazo y la información del abonado, y genera una Solicitud con su código único de seguimiento.',
  })
  @ApiResponse({
    status: 201,
    description: 'Solicitud de arreglo de pago registrada con éxito',
    type: Solicitud,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de validación inválidos o plazo no permitido',
  })
  crearArregloPago(
    @Body() dto: CreateSolicitudArregloPagoDto,
  ): Promise<Solicitud> {
    return this.solicitudesService.crearSolicitudArregloPago(dto);
  }

  @Get('aprobadas-pendientes')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary:
      'Listar solicitudes de servicio aprobadas pendientes de procesamiento',
  })
  findAprobadasPendientes(): Promise<SolicitudesAprobadaPendientesResponseDto> {
    return this.solicitudesService.findAprobadasPendientes();
  }

  @Get('seguimiento/:codigoSeguimiento')
  @ApiOperation({
    summary:
      'Consultar avance de solicitud por código de seguimiento (Público)',
    description:
      'Permite a los ciudadanos consultar el estado y avance de su trámite mediante su código único (Card 8).',
  })
  @ApiResponse({
    status: 200,
    description: 'Información actual de la solicitud',
    type: Solicitud,
  })
  @ApiResponse({
    status: 404,
    description: 'Solicitud no encontrada para el código especificado',
  })
  findByCodigoSeguimiento(
    @Param('codigoSeguimiento') codigoSeguimiento: string,
  ): Promise<Solicitud> {
    return this.solicitudesService.findByCodigoSeguimiento(codigoSeguimiento);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar solicitud por ID interno',
  })
  @ApiResponse({
    status: 200,
    type: Solicitud,
  })
  findById(@Param('id', ParseIntPipe) id: number): Promise<Solicitud> {
    return this.solicitudesService.findById(id);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Listar solicitudes digitales con filtros administrativos',
  })
  findAll(
    @Query() query: QuerySolicitudesDto,
  ): Promise<{ solicitudes: Solicitud[]; total: number }> {
    return this.solicitudesService.findAll(query);
  }
}
