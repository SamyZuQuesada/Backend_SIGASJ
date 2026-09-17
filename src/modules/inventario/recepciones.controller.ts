import {
  Body,
  Controller,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RegistrarRecepcionDto } from './dto/registrar-recepcion.dto';
import { InventarioService } from './inventario.service';

@ApiTags('Recepción de Materiales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class RecepcionesController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Post([
    'admin/inventario/recepciones',
    'inventario/recepciones',
    'admin/recepciones',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Registrar recepción física de materiales (Administradora)',
    description:
      'Confirma la llegada de materiales comprados, genera movimientos ENTRADA, ' +
      'actualiza existencias y marca la reposición como RECIBIDA.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Recepción registrada' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos inválidos o reposición en estado incompatible',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'La reposición ya fue recibida',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No encontrada' })
  registrarRecepcion(
    @Body() dto: RegistrarRecepcionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventarioService.registrarRecepcionReposicionAdmin(dto, user);
  }
}
