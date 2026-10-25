import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
  Res,
  StreamableFile,
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
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FormularioOficialItemDto } from './dto/formulario-oficial-response.dto';
import {
  FormulariosOficialesService,
  UploadedPdfFile,
} from './formularios-oficiales.service';

@ApiTags('Formularios Oficiales')
@Controller('solicitudes')
export class FormulariosOficialesController {
  constructor(
    private readonly formulariosService: FormulariosOficialesService,
  ) {}

  /* =========================================================================
   * GESTIÓN ADMINISTRATIVA:
   * ========================================================================= */

  @Get('admin/formularios-oficiales')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @ApiOperation({
    summary: 'Listar los 6 trámites oficiales y el estado de su PDF (Admin)',
    description:
      'Devuelve el catálogo de los 6 trámites oficiales indicando si tienen un PDF vigente configurado, su tamaño y fecha de actualización.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de formularios oficiales',
    type: [FormularioOficialItemDto],
  })
  listarFormulariosAdmin(): Promise<FormularioOficialItemDto[]> {
    return this.formulariosService.listarFormulariosOficialesAdmin();
  }

  @Put('admin/formularios-oficiales/:tipoSolicitudId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Subir o reemplazar el PDF oficial de un trámite (Admin)',
    description:
      'Sube un documento PDF auténtico para uno de los 6 trámites oficiales. Si ya existía un PDF previo, lo reemplaza de forma atómica y segura.',
  })
  @ApiParam({
    name: 'tipoSolicitudId',
    description: 'Identificador numérico del tipo de solicitud (1 al 6)',
    example: 1,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Documento en formato PDF oficial (máximo 10 MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'PDF oficial cargado o reemplazado exitosamente',
    type: FormularioOficialItemDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Archivo no es PDF válido, excede tamaño o tipo no oficial',
  })
  @ApiResponse({
    status: 404,
    description: 'Tipo de solicitud inexistente',
  })
  subirOReemplazarPdf(
    @Param('tipoSolicitudId', ParseIntPipe) tipoSolicitudId: number,
    @UploadedFile() file: UploadedPdfFile,
  ): Promise<FormularioOficialItemDto> {
    return this.formulariosService.subirOReemplazarPdf(tipoSolicitudId, file);
  }

  /* =========================================================================
   * DESCARGA PÚBLICA (Cards de Solicitudes Digitales):
   * ========================================================================= */

  @Get('formularios-oficiales')
  @ApiOperation({
    summary:
      'Listar los 6 trámites oficiales con su formulario PDF disponible (Público)',
    description:
      'Devuelve el catálogo público de los 6 trámites oficiales con su estado y enlace directo de descarga para las Cards del portal.',
  })
  @ApiResponse({
    status: 200,
    description: 'Catálogo de formularios oficiales descargables',
    type: [FormularioOficialItemDto],
  })
  listarFormulariosPublicos(): Promise<FormularioOficialItemDto[]> {
    return this.formulariosService.listarFormulariosOficialesAdmin();
  }

  @Get(':slug/formulario-oficial')
  @ApiOperation({
    summary: 'Descargar el PDF oficial correspondiente a un trámite (Público)',
    description:
      'Permite a los ciudadanos descargar directamente el formulario oficial en PDF de uno de los 6 trámites mediante su slug. No requiere autenticación y no crea solicitudes.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug oficial del trámite (ej. arreglo-pago, cambio-titular)',
    example: 'arreglo-pago',
  })
  @ApiResponse({
    status: 200,
    description: 'Archivo PDF descargable',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'Trámite no encontrado o el formulario todavía no se encuentra disponible',
  })
  async descargarFormularioPublico(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { streamableFile, filename } =
      await this.formulariosService.obtenerStreamDescargaPublica(slug);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
    });

    return streamableFile;
  }

  @Get('tipos/:slug/formulario-oficial')
  @ApiOperation({
    summary:
      'Alias de descarga de PDF oficial bajo ruta /tipos/:slug (Público)',
  })
  async descargarFormularioPublicoAlias(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.descargarFormularioPublico(slug, res);
  }
}
