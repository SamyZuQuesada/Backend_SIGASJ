import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { QueryAveriasAdminDto } from './dto/query-averias-admin.dto';

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
      'Listado privado, paginado y filtrado en SQL Server. Roles: ADMINISTRADORA y SECRETARIA. No incluye detalle, mutaciones ni el listado de Fontanero.',
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

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Consultar el detalle administrativo de una avería',
    description:
      'Consulta privada por PK. Roles: ADMINISTRADORA y SECRETARIA. Devuelve el contrato plano de Averia más datos del Reportante y campos administrativos nullable. No muta ni incluye historial.',
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
      'Detalle. Campos nullable: identificacionReportante, correoReportante, abonado, tipoAveria, prioridad, fontanero, fechaAsignacion, fechaInicioAtencion, fechaResolucion, observacionesAtencion.',
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
}
