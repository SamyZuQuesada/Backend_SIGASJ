import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { TipoMovimientoInventario } from '../../common/enums/tipo-movimiento-inventario.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { QueryReporteInventarioDto } from './dto/query-reporte-inventario.dto';
import { InventarioService } from './inventario.service';

@ApiTags('Reportes de inventario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ReportesController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Get([
    'admin/inventario/reportes/resumen',
    'inventario/reportes/resumen',
    'admin/inventario/reportes',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Consultar reporte consolidado de inventario (Administradora)',
    description:
      'Indicadores de materiales, stock bajo, entradas y salidas. Solo lectura.',
  })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String })
  @ApiQuery({ name: 'idMaterial', required: false, type: Number })
  @ApiQuery({ name: 'idCategoria', required: false, type: Number })
  @ApiQuery({ name: 'tipo', required: false, enum: TipoMovimientoInventario })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reporte consolidado' })
  resumen(@Query() query: QueryReporteInventarioDto) {
    return this.inventarioService.obtenerReporteInventarioAdmin(query);
  }
}
