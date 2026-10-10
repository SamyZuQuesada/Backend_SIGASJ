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
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePermisoColaboradorDto } from './dto/create-permiso-colaborador.dto';
import { QueryPermisosColaboradorDto } from './dto/query-permisos-colaborador.dto';
import { UpdatePermisoColaboradorDto } from './dto/update-permiso-colaborador.dto';
import { PermisoColaborador } from './entities/permiso-colaborador.entity';
import {
  PermisosColaboradorListado,
  PermisosColaboradorService,
} from './permisos-colaborador.service';

@ApiTags('Recursos Humanos - Permisos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRADORA)
@Controller('rrhh/permisos')
export class PermisosColaboradorController {
  constructor(
    private readonly permisosColaboradorService: PermisosColaboradorService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un permiso',
    description:
      'Registra un permiso administrativo asociado a un colaborador existente. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({
    status: 201,
    description: 'Permiso registrado.',
    type: PermisoColaborador,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos incompletos o inválidos, fechas inválidas o el colaborador no existe.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  create(
    @Body() dto: CreatePermisoColaboradorDto,
  ): Promise<PermisoColaborador> {
    return this.permisosColaboradorService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar permisos',
    description:
      'Listado paginado. Permite filtrar por colaborador y por un periodo de fechas. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Página de permisos: { data, total, page, limit, totalPages }.',
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  findAll(
    @Query() query: QueryPermisosColaboradorDto,
  ): Promise<PermisosColaboradorListado> {
    return this.permisosColaboradorService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de un permiso',
    description:
      'Incluye los datos del colaborador relacionado. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({ status: 200, type: PermisoColaborador })
  @ApiResponse({ status: 400, description: 'El id no es un número entero.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  @ApiResponse({ status: 404, description: 'El permiso no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PermisoColaborador> {
    return this.permisosColaboradorService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un permiso',
    description:
      'Actualiza solo los campos enviados. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({ status: 200, type: PermisoColaborador })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, cuerpo vacío, fechas inválidas o el colaborador no existe.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  @ApiResponse({ status: 404, description: 'El permiso no existe.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermisoColaboradorDto,
  ): Promise<PermisoColaborador> {
    return this.permisosColaboradorService.update(id, dto);
  }
}
