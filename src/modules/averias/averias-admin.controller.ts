import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AveriaAdminIdPipe } from './averia-admin-id.pipe';
import { AveriasService } from './averias.service';
import { AssignAveriaFontaneroDto } from './dto/assign-averia-fontanero.dto';
import { QueryAveriasAdminDto } from './dto/query-averias-admin.dto';
import { UpdateAveriaClasificacionDto } from './dto/update-averia-clasificacion.dto';
import { UpdateAveriaEstadoDto } from './dto/update-averia-estado.dto';
import { UpdateAveriaPrioridadDto } from './dto/update-averia-prioridad.dto';

@ApiTags('Averías (Administración)')
@Controller('admin/averias')
export class AveriasAdminController {
  constructor(private readonly averiasService: AveriasService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Listar averías para el panel administrativo',
    description:
      'Listado privado, paginado y filtrado en SQL Server. Roles: ADMINISTRADORA y SECRETARIA.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Página del listado. Colección vacía = 200 con data=[] y total=0.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Parámetros de consulta inválidos',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol autenticado sin permiso (p. ej. FONTANERO)',
  })
  findAllAdmin(@Query() query: QueryAveriasAdminDto) {
    return this.averiasService.findAllAdmin(query);
  }

  @Get('fontaneros')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Listar usuarios asignables como Fontanero',
    description:
      'Devuelve `{ data: [{ id, nombre }] }` de Fontaneros activos (`Role.FONTANERO`). Roles: ADMINISTRADORA y SECRETARIA.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado `{ data: [{ id, nombre }] }`. Vacío = data=[].',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol autenticado sin permiso (p. ej. FONTANERO)',
  })
  listFontanerosAsignables() {
    return this.averiasService.listFontanerosAsignables();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Consultar el detalle administrativo de una avería',
    description:
      'Consulta privada por PK. Roles: ADMINISTRADORA y SECRETARIA. Incluye fontanero `{ id, nombre }` y fechaAsignacion.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador entero positivo de Averia (PK identity)',
    example: 25,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalle administrativo.',
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
    description: 'Rol autenticado sin permiso (p. ej. FONTANERO)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No se encontró la avería solicitada.',
  })
  findOneAdmin(@Param('id', AveriaAdminIdPipe) id: number) {
    return this.averiasService.findOneAdmin(id);
  }

  @Patch(':id/estado')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Cambiar el estado administrativo de una avería',
    description:
      'Valida transiciones en Backend (PBI 2.3). ASIGNADA y EN_ATENCION exigen fontanero ya asignado. Roles: ADMINISTRADORA y SECRETARIA.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    example: 25,
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Detalle actualizado.' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Estado inválido, transición no permitida o ASIGNADA/EN_ATENCION sin fontanero.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol autenticado sin permiso (p. ej. FONTANERO)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No se encontró la avería solicitada.',
  })
  updateEstado(
    @Param('id', AveriaAdminIdPipe) id: number,
    @Body() dto: UpdateAveriaEstadoDto,
  ) {
    return this.averiasService.updateEstado(id, dto);
  }

  @Patch(':id/prioridad')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Establecer o modificar la prioridad de una avería',
  })
  @ApiParam({ name: 'id', type: Number, example: 25 })
  @ApiResponse({ status: HttpStatus.OK, description: 'Detalle actualizado.' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Prioridad inválida o campos extra.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol autenticado sin permiso (p. ej. FONTANERO)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No se encontró la avería solicitada.',
  })
  updatePrioridad(
    @Param('id', AveriaAdminIdPipe) id: number,
    @Body() dto: UpdateAveriaPrioridadDto,
  ) {
    return this.averiasService.updatePrioridad(id, dto);
  }

  @Patch(':id/clasificacion')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Clasificar administrativamente una avería',
    description: 'El body usa `clasificacion` y se persiste en `tipoAveria`.',
  })
  @ApiParam({ name: 'id', type: Number, example: 25 })
  @ApiResponse({ status: HttpStatus.OK, description: 'Detalle actualizado.' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Clasificación inválida o campos extra.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol autenticado sin permiso (p. ej. FONTANERO)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No se encontró la avería solicitada.',
  })
  updateClasificacion(
    @Param('id', AveriaAdminIdPipe) id: number,
    @Body() dto: UpdateAveriaClasificacionDto,
  ) {
    return this.averiasService.updateClasificacion(id, dto);
  }

  @Patch(':id/asignacion')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Asignar una avería a un Fontanero',
    description:
      'Asignación inicial atómica. Valida Usuario activo con rol FONTANERO, guarda fontanero y fechaAsignacion y pasa a ASIGNADA (grafo 2.3). No reasigna. Un FONTANERO autenticado no puede usar este endpoint.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador entero positivo de Averia',
    example: 25,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Detalle con fontanero `{ id }`, fechaAsignacion y estado ASIGNADA.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'ID inválido, transición no permitida, avería ya asignada o payload inválido.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol autenticado sin permiso (p. ej. FONTANERO)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Avería o Usuario/fontanero inexistente.',
  })
  assignFontanero(
    @Param('id', AveriaAdminIdPipe) id: number,
    @Body() dto: AssignAveriaFontaneroDto,
  ) {
    return this.averiasService.assignFontanero(id, dto);
  }
}
