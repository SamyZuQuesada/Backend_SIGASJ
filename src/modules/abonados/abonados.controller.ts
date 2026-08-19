import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AbonadosService } from './abonados.service';

@ApiTags('Abonados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('abonados')
export class AbonadosController {
  constructor(private readonly abonadosService: AbonadosService) {}

  @Get('me')
  @Roles(Role.ABONADO)
  @ApiOperation({
    summary: 'Consultar el abonado asociado al usuario autenticado',
  })
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.abonadosService.findOwn(user);
  }

  @Get(':id')
  @Roles(Role.ADMINISTRADORA, Role.ABONADO)
  @ApiOperation({
    summary:
      'Consultar un abonado por id (Administradora: cualquiera; Abonado: solo el propio)',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.abonadosService.findOneForRequester(id, user);
  }
}
