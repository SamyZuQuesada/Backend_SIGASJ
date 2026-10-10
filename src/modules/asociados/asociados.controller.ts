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
import { AsociadosListado, AsociadosService } from './asociados.service';
import { CreateAsociadoDto } from './dto/create-asociado.dto';
import { QueryAsociadosDto } from './dto/query-asociados.dto';
import { Asociado } from './entities/asociado.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Asociados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('asociados')
export class AsociadosController {
  constructor(private readonly asociadosService: AsociadosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Registrar un nuevo asociado',
    description:
      'Crea un nuevo asociado en estado activo en el sistema. Requiere autenticación con rol ADMINISTRADORA o SECRETARIA.',
  })
  @ApiResponse({
    status: 201,
    description: 'El asociado ha sido registrado exitosamente.',
    type: Asociado,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos incompletos o formato inválido (por ejemplo, correo electrónico inválido).',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado (token JWT faltante o inválido).',
  })
  @ApiResponse({
    status: 403,
    description:
      'No autorizado (el usuario no tiene rol ADMINISTRADORA ni SECRETARIA).',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto: Ya existe un asociado registrado con la misma cédula.',
  })
  async create(
    @Body() createAsociadoDto: CreateAsociadoDto,
  ): Promise<Asociado> {
    return this.asociadosService.create(createAsociadoDto);
  }

  @Get()
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Listar asociados',
    description:
      'Listado paginado. Permite buscar por nombre, apellidos o cédula y filtrar por estado. Requiere rol ADMINISTRADORA o SECRETARIA.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Página de asociados: { data, total, page, limit, totalPages }.',
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({
    status: 403,
    description: 'Sin rol ADMINISTRADORA ni SECRETARIA.',
  })
  async findAll(@Query() query: QueryAsociadosDto): Promise<AsociadosListado> {
    return this.asociadosService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Detalle de un asociado',
    description:
      'Obtiene la información de un asociado. Requiere rol ADMINISTRADORA o SECRETARIA.',
  })
  @ApiResponse({ status: 200, type: Asociado })
  @ApiResponse({ status: 400, description: 'El id no es un número entero.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({
    status: 403,
    description: 'Sin rol ADMINISTRADORA ni SECRETARIA.',
  })
  @ApiResponse({ status: 404, description: 'El asociado no existe.' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Asociado> {
    return this.asociadosService.findOne(id);
  }
}
