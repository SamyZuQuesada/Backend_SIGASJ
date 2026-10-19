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
import { CreateIncapacidadDto } from './dto/create-incapacidad.dto';
import { QueryIncapacidadesDto } from './dto/query-incapacidades.dto';
import { UpdateIncapacidadDto } from './dto/update-incapacidad.dto';
import { Incapacidad } from './entities/incapacidad.entity';
import {
  IncapacidadesListado,
  IncapacidadesService,
} from './incapacidades.service';

@ApiTags('Recursos Humanos - Incapacidades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
@Controller('rrhh/incapacidades')
export class IncapacidadesController {
  constructor(private readonly incapacidadesService: IncapacidadesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar una incapacidad',
    description:
      'Registra un periodo de incapacidad administrativa asociado a un colaborador existente. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({
    status: 201,
    description: 'Incapacidad registrada.',
    type: Incapacidad,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos incompletos o inválidos, o fechas fuera de orden.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  @ApiResponse({
    status: 404,
    description: 'El colaborador indicado no existe.',
  })
  create(@Body() dto: CreateIncapacidadDto): Promise<Incapacidad> {
    return this.incapacidadesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar incapacidades',
    description:
      'Listado paginado. Permite filtrar por colaborador y por un periodo de fechas (traslape). Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Página de incapacidades: { data, total, page, limit, totalPages }.',
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  findAll(
    @Query() query: QueryIncapacidadesDto,
  ): Promise<IncapacidadesListado> {
    return this.incapacidadesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de una incapacidad',
    description:
      'Incluye los datos del colaborador relacionado. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({ status: 200, type: Incapacidad })
  @ApiResponse({ status: 400, description: 'El id no es un número entero.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  @ApiResponse({ status: 404, description: 'La incapacidad no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Incapacidad> {
    return this.incapacidadesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una incapacidad',
    description:
      'Corrige solo los campos enviados. Valida el periodo resultante. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({ status: 200, type: Incapacidad })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos, cuerpo vacío o periodo resultante inválido.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  @ApiResponse({
    status: 404,
    description: 'La incapacidad o el colaborador indicado no existen.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIncapacidadDto,
  ): Promise<Incapacidad> {
    return this.incapacidadesService.update(id, dto);
  }
}
