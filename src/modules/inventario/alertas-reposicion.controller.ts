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
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { EstadoAlertaReposicion } from '../../common/enums/estado-alerta-reposicion.enum';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { QueryAlertasReposicionDto } from './dto/query-alertas-reposicion.dto';
import { CreateReposicionDesdeAlertaDto } from './dto/create-reposicion-desde-alerta.dto';
import { UpdateEstadoAlertaReposicionDto } from './dto/update-estado-alerta-reposicion.dto';
import { InventarioService } from './inventario.service';

@ApiTags('Alertas de Reposición')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AlertasReposicionController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Get([
    'admin/inventario/alertas-reposicion',
    'inventario/alertas-reposicion',
    'admin/alertas-reposicion',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Listar alertas de reposición (Administradora)',
    description:
      'Consulta administrativa de alertas generadas cuando un material alcanza o queda por debajo de su stock mínimo. ' +
      'Incluye material, unidad de medida, stock, estado, fecha y responsable de gestión cuando exista.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: EstadoAlertaReposicion,
    example: EstadoAlertaReposicion.PENDIENTE,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado paginado de alertas de reposición',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Parámetros de consulta inválidos',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Acceso restringido al rol ADMINISTRADORA',
  })
  listar(@Query() query: QueryAlertasReposicionDto) {
    return this.inventarioService.listarAlertasReposicionAdmin(query);
  }

  @Patch([
    'admin/inventario/alertas-reposicion/:id/estado',
    'inventario/alertas-reposicion/:id/estado',
    'admin/alertas-reposicion/:id/estado',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Actualizar el estado de una alerta de reposición (Administradora)',
    description:
      'Permite pasar una alerta de Pendiente a En gestión y de En gestión a Resuelta. ' +
      'Registra a la administradora responsable y la fecha de actualización. No modifica el stock.',
  })
  @ApiParam({ name: 'id', description: 'ID de la alerta', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Alerta actualizada',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Estado inválido o transición no permitida',
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
    description: 'Alerta no encontrada',
  })
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoAlertaReposicionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventarioService.cambiarEstadoAlertaReposicionAdmin(
      id,
      dto.estado,
      user,
    );
  }

  @Post([
    'admin/inventario/alertas-reposicion/:id/reposicion',
    'inventario/alertas-reposicion/:id/reposicion',
    'admin/alertas-reposicion/:id/reposicion',
  ])
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Generar reposición desde una alerta de stock mínimo (Administradora)',
    description:
      'Crea una reposición PENDIENTE vinculada a la alerta. No modifica las existencias del material. ' +
      'Rechaza alertas resueltas o reposiciones activas duplicadas.',
  })
  @ApiParam({ name: 'id', description: 'ID de la alerta', type: Number })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Reposición generada',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'La alerta no requiere reposición o los datos son inválidos',
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
    description: 'Alerta no encontrada',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ya existe una reposición activa para la alerta',
  })
  generarReposicion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateReposicionDesdeAlertaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventarioService.generarReposicionDesdeAlertaAdmin(id, user, dto);
  }
}
