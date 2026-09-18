import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { TipoMovimientoInventario } from '../../common/enums/tipo-movimiento-inventario.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { QueryMovimientosDto } from './dto/query-movimientos.dto';
import { InventarioService } from './inventario.service';

@ApiTags('Historial de movimientos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class MovimientosController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Get([
    'admin/inventario/movimientos',
    'inventario/movimientos',
    'admin/movimientos',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Consultar historial de movimientos de inventario (Administradora)',
    description:
      'Listado paginado de entradas y salidas registradas en MovimientoInventario. Solo lectura.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'tipo', required: false, enum: TipoMovimientoInventario })
  @ApiQuery({ name: 'idMaterial', required: false, type: Number })
  @ApiQuery({ name: 'idUsuario', required: false, type: Number })
  @ApiQuery({ name: 'idAveria', required: false, type: Number })
  @ApiQuery({ name: 'idSolicitud', required: false, type: Number })
  @ApiQuery({ name: 'idReposicion', required: false, type: Number })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Historial paginado' })
  listar(@Query() query: QueryMovimientosDto) {
    return this.inventarioService.listarMovimientosInventario(query);
  }

  @Get([
    'admin/inventario/movimientos/:id',
    'inventario/movimientos/:id',
    'admin/movimientos/:id',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Consultar detalle de un movimiento de inventario (Administradora)',
  })
  @ApiParam({ name: 'id', description: 'ID del movimiento', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Detalle del movimiento' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No encontrado' })
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.inventarioService.obtenerMovimientoInventario(id);
  }
}
