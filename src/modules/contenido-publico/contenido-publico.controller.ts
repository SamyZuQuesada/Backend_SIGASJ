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
import { CreateTransparenciaDto } from './dto/create-transparencia.dto';
import { UpdateGaleriaEstadoDto } from './dto/update-galeria-estado.dto';
import { UpdateGaleriaDto } from './dto/update-galeria.dto';
import { UpdateTransparenciaDto } from './dto/update-transparencia.dto';
import { UpdateTransparenciaEstadoDto } from './dto/update-transparencia-estado.dto';
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
  @ApiOperation({
    summary: 'Servir archivo público de comunicados, galería o transparencia',
  })
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

  @Patch('admin/galeria/:id/estado')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Activar o desactivar una fotografía (Admin)' })
  setGaleriaActiva(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGaleriaEstadoDto,
  ) {
    return this.contenidoPublicoService.setGaleriaActiva(id, dto.activa);
  }

  @Delete('admin/galeria/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Eliminar una fotografía de la galería (Admin)' })
  removeGaleria(@Param('id', ParseIntPipe) id: number) {
    return this.contenidoPublicoService.removeGaleria(id);
  }

  @Get('admin/transparencia')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Listar publicaciones de transparencia (Admin)' })
  getAdminTransparencia() {
    return this.contenidoPublicoService.getTransparenciaAdmin();
  }

  @Post('admin/transparencia')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiOperation({ summary: 'Crear una publicación de transparencia (Admin)' })
  createTransparencia(
    @Body() dto: CreateTransparenciaDto,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.contenidoPublicoService.createTransparencia(dto, file);
  }

  @Patch('admin/transparencia/:id')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiOperation({
    summary: 'Actualizar una publicación de transparencia (Admin)',
  })
  updateTransparencia(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransparenciaDto,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.contenidoPublicoService.updateTransparencia(id, dto, file);
  }

  @Patch('admin/transparencia/:id/estado')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Activar o desactivar una publicación de transparencia (Admin)',
  })
  setTransparenciaActiva(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransparenciaEstadoDto,
  ) {
    return this.contenidoPublicoService.setTransparenciaActiva(id, dto.activa);
  }

  @Delete('admin/transparencia/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Eliminar una publicación de transparencia (Admin)',
  })
  removeTransparencia(@Param('id', ParseIntPipe) id: number) {
    return this.contenidoPublicoService.removeTransparencia(id);
  }
}
