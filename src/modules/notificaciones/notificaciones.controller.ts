import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { NotificacionesAveriasService } from './notificaciones-averias.service';

@ApiTags('Notificaciones de averías')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly notificacionesAveriasService: NotificacionesAveriasService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar notificaciones internas del usuario autenticado',
    description:
      'La identidad se toma del JWT. No acepta id de destinatario en la consulta.',
  })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED })
  listarPropias(@CurrentUser() user: AuthenticatedUser) {
    return this.notificacionesAveriasService.listarPropias(user);
  }

  @Patch(':id/lectura')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar una notificación propia como leída',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiResponse({ status: HttpStatus.FORBIDDEN })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  marcarLeida(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificacionesAveriasService.marcarLeida(id, user);
  }
}
