import {
  Body,
  Controller,
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

  @Get('comunicados/:id')
  @ApiOperation({ summary: 'Obtener detalle de un comunicado por ID' })
  findOne(@Param('id') id: string) {
    return this.comunicadosService.findOne(id);
  }
}
