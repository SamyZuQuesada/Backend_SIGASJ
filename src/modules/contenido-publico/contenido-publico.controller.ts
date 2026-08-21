import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContenidoPublicoService } from './contenido-publico.service';
import { CreateGaleriaDto } from './dto/create-galeria.dto';
import { UpdateGaleriaDto } from './dto/update-galeria.dto';
import { UpdateContactoDto } from './dto/update-contacto.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import {
  streamPublicMedia,
  type UploadedImageFile,
} from '../../common/media/public-media';

@ApiTags('Contenido Público (Landing Page)')
@Controller()
export class ContenidoPublicoController {
  constructor(
    private readonly contenidoPublicoService: ContenidoPublicoService,
  ) {}

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

  @Get('public/galeria')
  @ApiOperation({ summary: 'Obtener galería de fotografías (Público)' })
  getPublicGaleria() {
    return this.contenidoPublicoService.getGaleria();
  }

  @Get('public/transparencia')
  @ApiOperation({ summary: 'Obtener documentos de transparencia (Público)' })
  getPublicTransparencia() {
    return this.contenidoPublicoService.getTransparencia();
  }

  @Get('public/media/:folder/:filename')
  @ApiOperation({ summary: 'Servir imagen pública de comunicados o galería' })
  getPublicMedia(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
  ) {
    return streamPublicMedia(folder, filename);
  }

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

  @Put('admin/contacto')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Actualizar contacto y ubicación (Admin)' })
  updateAdminContacto(@Body() dto: UpdateContactoDto) {
    return this.contenidoPublicoService.updateContacto(dto);
  }

  @Get('admin/galeria')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Listar fotografías de la galería (Admin)' })
  getAdminGaleria() {
    return this.contenidoPublicoService.getGaleriaAdmin();
  }

  @Post('admin/galeria')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @UseInterceptors(FileInterceptor('imagen'))
  @ApiOperation({ summary: 'Agregar una fotografía a la galería (Admin)' })
  createGaleria(
    @Body() dto: CreateGaleriaDto,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.contenidoPublicoService.createGaleria(dto, file);
  }

  @Patch('admin/galeria/:id')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @UseInterceptors(FileInterceptor('imagen'))
  @ApiOperation({ summary: 'Actualizar una fotografía de la galería (Admin)' })
  updateGaleria(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGaleriaDto,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.contenidoPublicoService.updateGaleria(id, dto, file);
  }

  @Delete('admin/galeria/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Eliminar una fotografía de la galería (Admin)' })
  removeGaleria(@Param('id', ParseIntPipe) id: number) {
    return this.contenidoPublicoService.removeGaleria(id);
  }
}
