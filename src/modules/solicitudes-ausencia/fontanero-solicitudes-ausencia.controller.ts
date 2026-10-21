import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CrearSolicitudAusenciaFontaneroDto } from './dto/crear-solicitud-ausencia-fontanero.dto';
import { SolicitudAusenciaFontaneroResponse } from './dto/solicitud-ausencia-fontanero.response';
import { SolicitudesAusenciaService } from './solicitudes-ausencia.service';

/**
 * PBI 6.5.3 — Consulta Fontanero de sus SolicitudAusencia.
 * El colaboradorId se resuelve solo desde JWT → usuarioId → Colaborador.
 */
@ApiTags('Fontanero · Solicitudes de ausencia')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FONTANERO)
@Controller('fontanero/solicitudes-ausencia')
export class FontaneroSolicitudesAusenciaController {
  constructor(
    private readonly solicitudesService: SolicitudesAusenciaService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar solicitudes de ausencia del Fontanero autenticado',
    description:
      'Devuelve únicamente las solicitudes del Colaborador vinculado a la cuenta. ' +
      'No acepta colaboradorId del cliente. Colección vacía si no hay solicitudes.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado propio (puede ser []).',
    type: SolicitudAusenciaFontaneroResponse,
    isArray: true,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Sin JWT.' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol incorrecto o sin Colaborador vinculado.',
  })
  listarPropias(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SolicitudAusenciaFontaneroResponse[]> {
    const usuarioId = user.idUsuario ?? Number(user.userId);
    return this.solicitudesService.listarSolicitudesPropias(usuarioId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear solicitud de ausencia (formulario Fontanero)',
    description:
      'Identidad solo por JWT → Colaborador. Estado inicial PENDIENTE. ' +
      'No crea PermisoColaborador ni MovimientoVacaciones.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Solicitud creada en PENDIENTE.',
    type: SolicitudAusenciaFontaneroResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos inválidos.',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Sin JWT.' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol incorrecto o sin Colaborador vinculado.',
  })
  crearPropia(
    @Body() dto: CrearSolicitudAusenciaFontaneroDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SolicitudAusenciaFontaneroResponse> {
    const usuarioId = user.idUsuario ?? Number(user.userId);
    return this.solicitudesService.crearSolicitudPropia(usuarioId, dto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detalle de una solicitud de ausencia propia',
    description:
      'Consulta con ownership (id + colaboradorId del usuario autenticado). ' +
      'Solicitud ajena o inexistente → 404.',
  })
  @ApiParam({ name: 'id', description: 'ID de la solicitud', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalle propio.',
    type: SolicitudAusenciaFontaneroResponse,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'ID inválido.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Sin JWT.' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol incorrecto o sin Colaborador vinculado.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Solicitud inexistente o ajena.',
  })
  obtenerPropia(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SolicitudAusenciaFontaneroResponse> {
    const usuarioId = user.idUsuario ?? Number(user.userId);
    return this.solicitudesService.obtenerSolicitudPropia(usuarioId, id);
  }
}
