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
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateMovimientoVacacionesDto } from './dto/create-movimiento-vacaciones.dto';
import { QueryMovimientosVacacionesDto } from './dto/query-movimientos-vacaciones.dto';
import { MovimientoVacaciones } from './entities/movimiento-vacaciones.entity';
import {
  BalanceVacaciones,
  MovimientosVacacionesListado,
  VacacionesService,
} from './vacaciones.service';

@ApiTags('Recursos Humanos - Vacaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRADORA)
@Controller('rrhh/vacaciones')
export class VacacionesController {
  constructor(private readonly vacacionesService: VacacionesService) {}

  @Post('movimientos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar días de vacaciones acumulados o disfrutados',
    description:
      'Registra un movimiento ACUMULADO (suma días) o DISFRUTADO (resta días) para un colaborador existente. ' +
      'Un DISFRUTADO se rechaza si dejaría el saldo del colaborador en negativo. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({
    status: 201,
    description: 'Movimiento registrado.',
    type: MovimientoVacaciones,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos incompletos o inválidos, tipo fuera del catálogo, cantidad no positiva, fecha inválida, colaborador inexistente o saldo insuficiente.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  registrarMovimiento(
    @Body() dto: CreateMovimientoVacacionesDto,
  ): Promise<MovimientoVacaciones> {
    return this.vacacionesService.registrarMovimiento(dto);
  }

  @Get('movimientos')
  @ApiOperation({
    summary: 'Historial de movimientos de vacaciones',
    description:
      'Listado paginado del historial. Permite filtrar por colaborador, tipo y rango de fechas del movimiento. ' +
      'Orden: fecha descendente. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Página de movimientos: { data, total, page, limit, totalPages }.',
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos.',
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  findAll(
    @Query() query: QueryMovimientosVacacionesDto,
  ): Promise<MovimientosVacacionesListado> {
    return this.vacacionesService.findAll(query);
  }

  @Get('colaboradores/:colaboradorId/balance')
  @ApiOperation({
    summary: 'Balance actual de vacaciones de un colaborador',
    description:
      'Devuelve días acumulados, disfrutados y disponibles calculados en el servidor a partir del historial de movimientos. ' +
      'El Frontend no debe recalcular el saldo. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ colaboradorId, colaborador, diasAcumulados, diasDisfrutados, diasDisponibles, totalMovimientos }.',
  })
  @ApiResponse({ status: 400, description: 'El id no es un número entero.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Sin rol ADMINISTRADORA.' })
  @ApiResponse({ status: 404, description: 'El colaborador no existe.' })
  obtenerBalance(
    @Param('colaboradorId', ParseIntPipe) colaboradorId: number,
  ): Promise<BalanceVacaciones> {
    return this.vacacionesService.obtenerBalance(colaboradorId);
  }
}
