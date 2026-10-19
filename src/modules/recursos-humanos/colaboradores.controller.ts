import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  ColaboradoresListado,
  ColaboradoresService,
} from './colaboradores.service';
import { CreateColaboradorDto } from './dto/create-colaborador.dto';
import { HistorialColaboradorResponseDto } from './dto/historial-colaborador.dto';
import { QueryColaboradoresDto } from './dto/query-colaboradores.dto';
import { QueryHistorialColaboradorDto } from './dto/query-historial-colaborador.dto';
import { UpdateColaboradorDto } from './dto/update-colaborador.dto';
import { UpdateEstadoColaboradorDto } from './dto/update-estado-colaborador.dto';
import { Colaborador } from './entities/colaborador.entity';
import { HistorialColaboradorService } from './historial-colaborador.service';
import { RRHH_ADMIN_ROLES } from './rrhh-roles';

@ApiTags('Recursos Humanos - Colaboradores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...RRHH_ADMIN_ROLES)
@Controller('rrhh/colaboradores')
export class ColaboradoresController {
  constructor(
    private readonly colaboradoresService: ColaboradoresService,
    private readonly historialColaboradorService: HistorialColaboradorService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un colaborador',
    description:
      'Registra un colaborador activo (fontanero o personal administrativo). Puede relacionarse con una cuenta de usuario existente. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({
    status: 201,
    description: 'Colaborador registrado.',
    type: Colaborador,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos incompletos o inválidos (cédula, correo) o el usuario indicado no existe.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  @ApiResponse({
    status: 409,
    description:
      'Ya existe un colaborador con esa cédula o la cuenta de usuario ya está asignada.',
  })
  create(@Body() dto: CreateColaboradorDto): Promise<Colaborador> {
    return this.colaboradoresService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar colaboradores',
    description:
      'Listado paginado. Permite buscar por nombre, apellidos o cédula y filtrar por cargo y estado. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Página de colaboradores: { data, total, page, limit, totalPages }.',
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  findAll(
    @Query() query: QueryColaboradoresDto,
  ): Promise<ColaboradoresListado> {
    return this.colaboradoresService.findAll(query);
  }

  @Get(':id/historial')
  @ApiOperation({
    summary: 'Historial administrativo del colaborador',
    description:
      'Consulta de solo lectura que unifica permisos, movimientos de vacaciones e incapacidades. Permite filtrar por tipo y rango de fechas, y paginar. Orden: más reciente primero. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Historial consolidado paginado: { colaborador, historial, total, page, limit, totalPages }.',
    type: HistorialColaboradorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Id inválido o parámetros de filtro/paginación inválidos.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  @ApiResponse({
    status: 404,
    description: 'No se encontró el colaborador solicitado.',
  })
  getHistorial(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryHistorialColaboradorDto,
  ): Promise<HistorialColaboradorResponseDto> {
    return this.historialColaboradorService.getHistorialColaborador(id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de un colaborador',
    description:
      'Incluye la cuenta de usuario relacionada, si tiene. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({ status: 200, type: Colaborador })
  @ApiResponse({ status: 400, description: 'El id no es un número entero.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  @ApiResponse({ status: 404, description: 'El colaborador no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Colaborador> {
    return this.colaboradoresService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar información de un colaborador',
    description:
      'Actualiza solo los campos enviados (nombre, apellidos, cédula, correo, cargo, usuarioId). El estado se cambia con PATCH /:id/estado. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({ status: 200, type: Colaborador })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, cuerpo vacío o el usuario indicado no existe.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  @ApiResponse({ status: 404, description: 'El colaborador no existe.' })
  @ApiResponse({
    status: 409,
    description:
      'La cédula ya pertenece a otro colaborador o la cuenta de usuario ya está asignada.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateColaboradorDto,
  ): Promise<Colaborador> {
    return this.colaboradoresService.update(id, dto);
  }

  @Patch(':id/estado')
  @ApiOperation({
    summary: 'Activar o inactivar un colaborador',
    description:
      'Cambia el estado sin eliminar el registro; su historial se conserva. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({ status: 200, type: Colaborador })
  @ApiResponse({ status: 400, description: 'Falta activo o no es booleano.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  @ApiResponse({ status: 404, description: 'El colaborador no existe.' })
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoColaboradorDto,
  ): Promise<Colaborador> {
    return this.colaboradoresService.cambiarEstado(id, dto.activo);
  }
}
