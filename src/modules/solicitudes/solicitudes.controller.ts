import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SolicitudesAprobadaPendientesResponseDto } from './dto/solicitudes-aprobada-pendientes-response.dto';
import { SolicitudesService } from './solicitudes.service';

@ApiTags('Solicitudes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Get('aprobadas-pendientes')
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary:
      'Listar solicitudes de servicio aprobadas pendientes de procesamiento',
  })
  findAprobadasPendientes(): Promise<SolicitudesAprobadaPendientesResponseDto> {
    return this.solicitudesService.findAprobadasPendientes();
  }
}
