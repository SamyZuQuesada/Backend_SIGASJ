import {
  Body,
  Controller,
  ForbiddenException,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateMovimientoVacacionesDto } from './dto/create-movimiento-vacaciones.dto';
import { QueryMovimientosVacacionesDto } from './dto/query-movimientos-vacaciones.dto';
import { MovimientoVacaciones } from './entities/movimiento-vacaciones.entity';
import { RRHH_ADMIN_ROLES } from './rrhh-roles';
import {
  BalanceVacaciones,
  MovimientosVacacionesListado,
  VacacionesService,
} from './vacaciones.service';

@ApiTags('Recursos Humanos - Vacaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rrhh/vacaciones')
export class VacacionesController {
  constructor(private readonly vacacionesService: VacacionesService) {}

  @Get('mias/balance')
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Saldo de vacaciones del Fontanero autenticado (solo lectura)',
  })
  @ApiResponse({ status: 200, description: 'Balance propio.' })
  @ApiResponse({
    status: 403,
    description: 'Sin vínculo colaborador o rol incorrecto.',
  })
  obtenerBalancePropio(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BalanceVacaciones> {
    const usuarioId = user.idUsuario ?? Number(user.userId);
    return this.vacacionesService.obtenerBalancePorUsuarioId(usuarioId);
  }

  @Post('movimientos')
  @Roles(...RRHH_ADMIN_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar ACUMULADO, DISFRUTADO o AJUSTE',
    description:
      'ACUMULADO y DISFRUTADO: solo ADMINISTRADORA. ' +
      'AJUSTE: ADMINISTRADORA o SECRETARIA (motivo + auditoría).',
  })
  @ApiResponse({
    status: 201,
    description: 'Movimiento registrado.',
    type: MovimientoVacaciones,
  })
  registrarMovimiento(
    @Body() dto: CreateMovimientoVacacionesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MovimientoVacaciones> {
    const rol = String(user.role ?? '').toUpperCase();
    if (
      (dto.tipo === 'ACUMULADO' || dto.tipo === 'DISFRUTADO') &&
      rol !== Role.ADMINISTRADORA &&
      rol !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Solo la Administradora puede registrar adquisiciones o disfrutes de vacaciones',
      );
    }
    const registradoPorUsuarioId = user.idUsuario ?? Number(user.userId);
    return this.vacacionesService.registrarMovimiento({
      ...dto,
      registradoPorUsuarioId,
    });
  }

  @Get('movimientos')
  @Roles(...RRHH_ADMIN_ROLES)
  @ApiOperation({ summary: 'Historial de movimientos de vacaciones' })
  findAll(
    @Query() query: QueryMovimientosVacacionesDto,
  ): Promise<MovimientosVacacionesListado> {
    return this.vacacionesService.findAll(query);
  }

  @Get('colaboradores/:colaboradorId/balance')
  @Roles(...RRHH_ADMIN_ROLES)
  @ApiOperation({
    summary: 'Balance actual de vacaciones de un colaborador',
  })
  obtenerBalance(
    @Param('colaboradorId', ParseIntPipe) colaboradorId: number,
  ): Promise<BalanceVacaciones> {
    return this.vacacionesService.obtenerBalance(colaboradorId);
  }
}
