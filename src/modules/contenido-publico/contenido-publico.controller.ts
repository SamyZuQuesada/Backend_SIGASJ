import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContenidoPublicoService } from './contenido-publico.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Contenido Público (Landing Page)')
@Controller()
export class ContenidoPublicoController {
  constructor(
    private readonly contenidoPublicoService: ContenidoPublicoService,
  ) {}

  // ==================== ENDPOINTS PÚBLICOS ====================

  @Get('public/informacion')
  @ApiOperation({ summary: 'Obtener información institucional (Público)' })
  getPublicInformacion() {
    return this.contenidoPublicoService.getInformacionInstitucional();
  }

  @Get('public/contacto')
  @ApiOperation({
    summary: 'Obtener información de contacto y ubicación (Público)',
  })
  getPublicContacto() {
    return this.contenidoPublicoService.getContacto();
  }

  @Get('public/transparencia')
  @ApiOperation({ summary: 'Obtener documentos de transparencia (Público)' })
  getPublicTransparencia() {
    return this.contenidoPublicoService.getTransparencia();
  }

  // ==================== ENDPOINTS ADMINISTRATIVOS ====================

  @Get('admin/informacion')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Consultar información institucional para edición (Admin)',
  })
  getAdminInformacion() {
    return this.contenidoPublicoService.getInformacionInstitucional();
  }

  @Get('admin/contacto')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Consultar datos de contacto para edición (Admin)' })
  getAdminContacto() {
    return this.contenidoPublicoService.getContacto();
  }
}
