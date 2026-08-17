import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ComunicadosService } from './comunicados.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Comunicados')
@Controller()
export class ComunicadosController {
  constructor(private readonly comunicadosService: ComunicadosService) {}

  // Consulta pública para el Landing Page
  @Get('public/comunicados')
  @ApiOperation({
    summary: 'Obtener comunicados públicos y vigentes (Público)',
  })
  findPublicos() {
    return this.comunicadosService.findPublicos();
  }

  // Administración de comunicados
  @Get('admin/comunicados')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Listar todos los comunicados para administración (Admin)',
  })
  findAllAdmin() {
    return this.comunicadosService.findAllAdmin();
  }

  @Get('comunicados/:id')
  @ApiOperation({ summary: 'Obtener detalle de un comunicado por ID' })
  findOne(@Param('id') id: string) {
    return this.comunicadosService.findOne(id);
  }
}
