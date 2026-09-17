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
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { EstadoReposicionMaterial } from '../../common/enums/estado-reposicion-material.enum';
import { OrigenReposicionMaterial } from '../../common/enums/origen-reposicion-material.enum';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { QueryReposicionesDto } from './dto/query-reposiciones.dto';
import { RegistrarCompraReposicionDto } from './dto/registrar-compra-reposicion.dto';
import { InventarioService } from './inventario.service';

@ApiTags('Reposiciones de Materiales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ReposicionesController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Get([
    'admin/inventario/reposiciones',
    'inventario/reposiciones',
    'admin/reposiciones',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Listar reposiciones de materiales (Administradora)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoReposicionMaterial })
  @ApiQuery({ name: 'origen', required: false, enum: OrigenReposicionMaterial })
  @ApiResponse({ status: HttpStatus.OK, description: 'Listado paginado' })
  listar(@Query() query: QueryReposicionesDto) {
    return this.inventarioService.listarReposicionesAdmin(query);
  }

  @Get([
    'admin/inventario/reposiciones/:id',
    'inventario/reposiciones/:id',
    'admin/reposiciones/:id',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Consultar detalle de una reposición (Administradora)',
  })
  @ApiParam({ name: 'id', description: 'ID de la reposición', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Detalle de la reposición' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No encontrada' })
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.inventarioService.obtenerReposicionAdmin(id);
  }

  @Post([
    'admin/inventario/reposiciones/:id/compra',
    'inventario/reposiciones/:id/compra',
    'admin/reposiciones/:id/compra',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Registrar compra de una reposición (Administradora)',
    description:
      'Asocia proveedor, fecha y cantidades adquiridas a una reposición existente. ' +
      'No modifica las existencias del inventario.',
  })
  @ApiParam({ name: 'id', description: 'ID de la reposición', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compra registrada',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos inválidos o reposición en estado incompatible',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Acceso restringido al rol ADMINISTRADORA',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Reposición o proveedor no encontrado',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'La reposición ya tiene una compra registrada',
  })
  registrarCompra(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarCompraReposicionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventarioService.registrarCompraReposicionAdmin(id, dto, user);
  }
}
