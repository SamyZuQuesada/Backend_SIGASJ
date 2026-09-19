import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { AveriaAdminIdPipe } from './averia-admin-id.pipe';
import { AveriasService } from './averias.service';
import { CreateObservacionAveriaDto } from './dto/create-observacion-averia.dto';
import { IniciarAtencionAveriaDto } from './dto/iniciar-atencion-averia.dto';
import { ResolverAveriaDto } from './dto/resolver-averia.dto';

@ApiTags('Averías (Fontanero)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FONTANERO)
@Controller('fontanero/averias')
export class AveriasFontaneroController {
  constructor(private readonly averiasService: AveriasService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar averías asignadas al Fontanero autenticado',
    description:
      'Solo averías del JWT en Asignada, Pendiente de atención o En atención. Las resueltas no aparecen como pendientes. No acepta filtros del cliente para cambiar de Fontanero.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado `{ data: [...] }`. Vacío = data=[].',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol distinto de FONTANERO',
  })
  findAllFontanero(@CurrentUser() user: AuthenticatedUser) {
    return this.averiasService.findAllFontanero(user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consultar el detalle de una avería asignada al Fontanero',
    description:
      'La identidad se toma del JWT. Solo devuelve la avería si está asignada al Fontanero autenticado.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador entero positivo de Averia (PK identity)',
    example: 25,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalle de la avería asignada al Fontanero autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'ID con formato inválido (no entero positivo)',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Rol distinto de FONTANERO o la avería no está asignada al usuario autenticado',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No se encontró la avería solicitada.',
  })
  findOneFontanero(
    @Param('id', AveriaAdminIdPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.averiasService.findOneFontanero(id, user);
  }

  @Post(':id/observaciones')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar una observación de atención en una avería asignada',
    description:
      'La identidad del autor se toma del JWT. El Fontanero solo puede registrar observaciones en averías asignadas a él. Cada llamada inserta una fila nueva.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador entero positivo de Averia (PK identity)',
    example: 25,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Observación persistida como registro independiente.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'ID inválido u observación vacía.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Rol distinto de FONTANERO o la avería no está asignada al usuario autenticado',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No se encontró la avería solicitada.',
  })
  createObservacionAveria(
    @Param('id', AveriaAdminIdPipe) id: number,
    @Body() dto: CreateObservacionAveriaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.averiasService.createObservacionAveria(id, dto, user);
  }

  @Patch(':id/iniciar-atencion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar la atención de una avería asignada',
    description:
      'Solo el Fontanero asignado. Exige horario laboral del Backend. Si está fuera de jornada, rechaza y no registra fecha de inicio. Un PATCH administrativo a EN_ATENCION aplica la misma regla.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador entero positivo de Averia',
    example: 25,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Avería en atención con fechaInicioAtencion del servidor.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Transición no permitida o Fontanero fuera de horario laboral.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Rol distinto de FONTANERO o la avería no está asignada al usuario autenticado',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No se encontró la avería solicitada.',
  })
  iniciarAtencion(
    @Param('id', AveriaAdminIdPipe) id: number,
    @Body() _dto: IniciarAtencionAveriaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.averiasService.iniciarAtencion(id, user);
  }

  @Patch(':id/resolver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar como resuelta una avería en atención',
    description:
      'Solo el Fontanero asignado. Requiere observación final. El estado Resuelta, la fecha de resolución y el autor se generan en servidor.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador entero positivo de Averia (PK identity)',
    example: 25,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Avería resuelta y observación final registrada.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Observación inválida o la avería no está en atención.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Rol distinto de FONTANERO o la avería no está asignada al usuario autenticado',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No se encontró la avería solicitada.',
  })
  resolverAveria(
    @Param('id', AveriaAdminIdPipe) id: number,
    @Body() dto: ResolverAveriaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.averiasService.resolverAveria(id, dto, user);
  }
}
