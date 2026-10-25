import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateFormularioDescargableDto } from './dto/create-formulario-descargable.dto';
import { FormularioDescargableAdminResponse } from './dto/formulario-descargable-admin.response';
import { UpdateFormularioDescargableDto } from './dto/update-formulario-descargable.dto';
import { UpdateFormularioDescargableEstadoDto } from './dto/update-formulario-descargable-estado.dto';
import {
  FormulariosDescargablesService,
  type UploadedFormularioPdfFile,
} from './formularios-descargables.service';

@ApiTags('Formularios descargables (Admin)')
@Controller()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
export class FormulariosDescargablesController {
  constructor(
    private readonly formulariosDescargablesService: FormulariosDescargablesService,
  ) {}

  @Get('admin/formularios-descargables')
  @ApiOperation({
    summary: 'Listar formularios descargables (activos e inactivos)',
  })
  listar(): Promise<FormularioDescargableAdminResponse[]> {
    return this.formulariosDescargablesService.listarAdmin();
  }

  @Post('admin/formularios-descargables')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiOperation({
    summary: 'Crear formulario descargable con PDF obligatorio',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['nombre', 'archivo'],
      properties: {
        nombre: { type: 'string', maxLength: 200 },
        descripcion: { type: 'string', maxLength: 1000 },
        activo: { type: 'boolean' },
        fechaPublicacion: { type: 'string', format: 'date-time' },
        archivo: { type: 'string', format: 'binary' },
      },
    },
  })
  crear(
    @Body() dto: CreateFormularioDescargableDto,
    @UploadedFile() file?: UploadedFormularioPdfFile,
  ): Promise<FormularioDescargableAdminResponse> {
    return this.formulariosDescargablesService.crear(dto, file);
  }

  @Patch('admin/formularios-descargables/:id')
  @ApiOperation({
    summary: 'Editar metadata (nombre, descripción, fechaPublicacion)',
  })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFormularioDescargableDto,
  ): Promise<FormularioDescargableAdminResponse> {
    return this.formulariosDescargablesService.actualizarMetadata(id, dto);
  }

  @Patch('admin/formularios-descargables/:id/archivo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiOperation({
    summary: 'Reemplazar PDF (conserva el anterior si el reemplazo falla)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: {
        archivo: { type: 'string', format: 'binary' },
      },
    },
  })
  reemplazarArchivo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: UploadedFormularioPdfFile,
  ): Promise<FormularioDescargableAdminResponse> {
    return this.formulariosDescargablesService.reemplazarArchivo(id, file);
  }

  @Patch('admin/formularios-descargables/:id/estado')
  @ApiOperation({
    summary: 'Activar o inactivar (no elimina registro ni PDF)',
  })
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFormularioDescargableEstadoDto,
  ): Promise<FormularioDescargableAdminResponse> {
    return this.formulariosDescargablesService.cambiarEstado(id, dto.activo);
  }
}
