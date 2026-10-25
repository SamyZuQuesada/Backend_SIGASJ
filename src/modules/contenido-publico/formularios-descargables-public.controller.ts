import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { FormularioDescargablePublicoResponse } from './dto/formulario-descargable-publico.response';
import { FormulariosDescargablesService } from './formularios-descargables.service';

/**
 * Catálogo y descarga públicos (sin JWT).
 * Solo formularios activos. No crea Solicitud ni inicia trámite.
 */
@ApiTags('Formularios descargables (Público)')
@Controller()
export class FormulariosDescargablesPublicController {
  constructor(
    private readonly formulariosDescargablesService: FormulariosDescargablesService,
  ) {}

  @Get('public/formularios-descargables')
  @ApiOperation({
    summary: 'Listar formularios descargables activos (público)',
  })
  listar(): Promise<FormularioDescargablePublicoResponse[]> {
    return this.formulariosDescargablesService.listarPublicos();
  }

  @Get('public/formularios-descargables/:id/descarga')
  @ApiOperation({
    summary: 'Descargar PDF de un formulario activo (público)',
  })
  async descargar(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { streamableFile, filename } =
      await this.formulariosDescargablesService.obtenerStreamDescargaPublica(
        id,
      );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
    });

    return streamableFile;
  }
}
