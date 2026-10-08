import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AsociadosService } from './asociados.service';
import { CreateAsociadoDto } from './dto/create-asociado.dto';
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
    summary: 'Listar todos los asociados registrados',
    description: 'Obtiene el listado completo de asociados.',
  })
  async findAll(): Promise<Asociado[]> {
    return this.asociadosService.findAll();
  }
}
