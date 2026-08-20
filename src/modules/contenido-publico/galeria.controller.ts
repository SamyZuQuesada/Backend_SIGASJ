import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateGaleriaFotoDto,
  ListGaleriaFotoQueryDto,
  UpdateGaleriaFotoActivoDto,
  UpdateGaleriaFotoDto,
} from './dto/galeria-foto.dto';
import { GaleriaService } from './galeria.service';

const galleryUploadInterceptor = FileInterceptor('imagen', {
  storage: memoryStorage(),
});

@ApiTags('Galería (Landing Page)')
@Controller()
export class GaleriaController {
  constructor(private readonly galeriaService: GaleriaService) {}

  @Get('public/galeria')
  @ApiOperation({ summary: 'Obtener galería pública de fotografías activas' })
  findPublicas() {
    return this.galeriaService.findPublicas();
  }

  @Get('admin/galeria')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Listar fotografías de galería para administración' })
  findAllAdmin(@Query() query: ListGaleriaFotoQueryDto) {
    return this.galeriaService.findAllAdmin(query);
  }

  @Get('admin/galeria/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Obtener detalle de una fotografía de galería' })
  findOneAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.galeriaService.findOneAdmin(id);
  }

  @Post('admin/galeria')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['imagen', 'textoAlternativo'],
      properties: {
        imagen: { type: 'string', format: 'binary' },
        titulo: { type: 'string' },
        descripcion: { type: 'string' },
        textoAlternativo: { type: 'string' },
        ordenVisualizacion: { type: 'integer', example: 0 },
        activo: { type: 'boolean', example: true },
      },
    },
  })
  @UseInterceptors(galleryUploadInterceptor)
  @ApiOperation({ summary: 'Crear fotografía de galería con imagen' })
  create(
    @Body() dto: CreateGaleriaFotoDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.galeriaService.create(dto, file);
  }

  @Patch('admin/galeria/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imagen: { type: 'string', format: 'binary' },
        titulo: { type: 'string' },
        descripcion: { type: 'string' },
        textoAlternativo: { type: 'string' },
        ordenVisualizacion: { type: 'integer' },
        activo: { type: 'boolean' },
      },
    },
  })
  @UseInterceptors(galleryUploadInterceptor)
  @ApiOperation({ summary: 'Actualizar metadatos y/o imagen de galería' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGaleriaFotoDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.galeriaService.update(id, dto, file);
  }

  @Patch('admin/galeria/:id/activo')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Activar o desactivar una fotografía de galería' })
  updateActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGaleriaFotoActivoDto,
  ) {
    return this.galeriaService.updateActivo(id, dto.activo);
  }

  @Delete('admin/galeria/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Eliminar una fotografía de galería' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.galeriaService.remove(id);
  }
}
