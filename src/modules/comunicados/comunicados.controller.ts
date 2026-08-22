import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ComunicadosService } from './comunicados.service';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoEstadoDto } from './dto/update-comunicado-estado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { UploadedImageFile } from '../../common/media/public-media';

@ApiTags('Comunicados')
@Controller()
export class ComunicadosController {
  constructor(private readonly comunicadosService: ComunicadosService) {}

  @Get('public/comunicados')
  @ApiOperation({
    summary: 'Obtener comunicados públicos y vigentes (Público)',
  })
  findPublicos() {
    return this.comunicadosService.findPublicos();
  }

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

  @Post('admin/comunicados')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @UseInterceptors(FileInterceptor('imagen'))
  @ApiOperation({ summary: 'Crear un comunicado (Admin)' })
  create(
    @Body() dto: CreateComunicadoDto,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.comunicadosService.create(dto, file);
  }

  @Patch('admin/comunicados/:id')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @UseInterceptors(FileInterceptor('imagen'))
  @ApiOperation({ summary: 'Actualizar un comunicado (Admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateComunicadoDto,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.comunicadosService.update(id, dto, file);
  }

  @Patch('admin/comunicados/:id/estado')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Activar o desactivar un comunicado (Admin)' })
  setEstado(
    @Param('id') id: string,
    @Body() dto: UpdateComunicadoEstadoDto,
  ) {
    return this.comunicadosService.setEstado(id, dto.estado);
  }

  @Delete('admin/comunicados/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({ summary: 'Eliminar un comunicado (Admin)' })
  remove(@Param('id') id: string) {
    return this.comunicadosService.remove(id);
  }

  @Get('comunicados/:id')
  @ApiOperation({ summary: 'Obtener detalle de un comunicado por ID' })
  findOne(@Param('id') id: string) {
    return this.comunicadosService.findOne(id);
  }
}
