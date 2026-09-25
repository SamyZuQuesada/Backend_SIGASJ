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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AveriaAdminIdPipe } from './averia-admin-id.pipe';
import { AveriasService } from './averias.service';
import { AssignAveriaFontaneroDto } from './dto/assign-averia-fontanero.dto';
import { QueryAveriasAdminDto } from './dto/query-averias-admin.dto';
import { QueryHistorialAveriasAdminDto } from './dto/query-historial-averias-admin.dto';
import { QueryReporteResumenAveriasDto } from './dto/query-reporte-resumen-averias.dto';
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

  @Get('historial')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Consultar el historial general de averías',
    description:
      'Listado histórico paginado de averías activas y resueltas. Incluye Recibida, Asignada, Pendiente de atención, En atención y Resuelta. No es la línea de tiempo de un solo caso. Roles: ADMINISTRADORA y SECRETARIA.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Página del historial. Sin coincidencias = 200 con data=[] y total=0. fechaResolucion es null si la avería no está resuelta.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Filtro inválido. Reportada y En proceso no son estados vigentes.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol autenticado sin permiso (p. ej. FONTANERO)',
  })
  findHistorialAdmin(@Query() query: QueryHistorialAveriasAdminDto) {
    return this.averiasService.findHistorialAdmin(query);
  }

  @Get('reportes/resumen')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Consultar el resumen de averías por estado',
    description:
      'Conteos reales sobre fechaReporte. Incluye Recibida, Asignada, Pendiente de atención, En atención y Resuelta. El total es la suma de los estados del periodo. No usa En proceso. Roles: ADMINISTRADORA y SECRETARIA.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Indicadores del periodo. Sin averías = 200 con total 0 y cada estado en 0.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Rango de fechas inválido',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sin autenticación o token inválido',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol autenticado sin permiso (p. ej. FONTANERO)',
  })
  reporteResumenAdmin(@Query() query: QueryReporteResumenAveriasDto) {
    return this.averiasService.reporteResumenAdmin(query);
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

  @Get(':id/historial')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Consultar la línea de tiempo de una avería',
    description:
      'Eventos históricos de una sola avería, del más antiguo al más reciente. No es el listado general. Roles: ADMINISTRADORA y SECRETARIA.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador entero positivo de Averia (PK identity)',
    example: 25,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Línea de tiempo. Sin eventos = 200 con data=[]. usuario es null si no hubo responsable.',
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
  findEventosHistorialAdmin(@Param('id', AveriaAdminIdPipe) id: number) {
    return this.averiasService.findEventosHistorialAdmin(id);
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
      'Valida transiciones en Backend (PBI 2.3). ASIGNADA y EN_ATENCION exigen fontanero ya asignado. Pasar a EN_ATENCION exige horario laboral del Fontanero asignado y registra fechaInicioAtencion en el servidor. Roles: ADMINISTRADORA y SECRETARIA.',
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.averiasService.updateEstado(id, dto, user);
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.averiasService.updatePrioridad(id, dto, user);
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.averiasService.updateClasificacion(id, dto, user);
  }

  @Patch(':id/asignacion')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Asignar una avería a un Fontanero',
    description:
      'Asignación inicial atómica. Valida Usuario activo con rol FONTANERO, guarda fontanero y fechaAsignacion y pasa a ASIGNADA (grafo 2.3). Luego valida el horario laboral del Backend: si no está en jornada, queda PENDIENTE sin soltar al Fontanero. No reasigna ni envía SMS. Un FONTANERO autenticado no puede usar este endpoint.',
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
      'Detalle con fontanero, fechaAsignacion, estado ASIGNADA o PENDIENTE según horario, y el evento de notificación preparado si aplica.',
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.averiasService.assignFontanero(id, dto, user);
  }
}
