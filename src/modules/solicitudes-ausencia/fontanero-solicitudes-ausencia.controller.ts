import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  MAX_ACTIVIDAD_DOCUMENT_BYTES,
  type UploadedImageFile,
} from '../../common/media/public-media';
import { CrearSolicitudAusenciaFontaneroDto } from './dto/crear-solicitud-ausencia-fontanero.dto';
import { SolicitudAusenciaFontaneroResponse } from './dto/solicitud-ausencia-fontanero.response';
import { SolicitudesAusenciaService } from './solicitudes-ausencia.service';

/**
 * PBI 6.5.3 — Consulta Fontanero de sus SolicitudAusencia.
 * El colaboradorId se resuelve solo desde JWT → usuarioId → Colaborador.
 */
@ApiTags('Fontanero · Solicitudes de ausencia')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FONTANERO)
@Controller('fontanero/solicitudes-ausencia')
export class FontaneroSolicitudesAusenciaController {
  constructor(
    private readonly solicitudesService: SolicitudesAusenciaService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar solicitudes de ausencia del Fontanero autenticado',
    description:
      'Devuelve únicamente las solicitudes del Colaborador vinculado a la cuenta. ' +
      'No acepta colaboradorId del cliente. Colección vacía si no hay solicitudes.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado propio (puede ser []).',
    type: SolicitudAusenciaFontaneroResponse,
    isArray: true,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Sin JWT.' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol incorrecto o sin Colaborador vinculado.',
  })
  listarPropias(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SolicitudAusenciaFontaneroResponse[]> {
    const usuarioId = user.idUsuario ?? Number(user.userId);
    return this.solicitudesService.listarSolicitudesPropias(usuarioId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear solicitud de ausencia (formulario Fontanero)',
    description:
      'Identidad solo por JWT → Colaborador. Estado inicial PENDIENTE. ' +
      'No crea PermisoColaborador ni MovimientoVacaciones.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Solicitud creada en PENDIENTE.',
    type: SolicitudAusenciaFontaneroResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos inválidos.',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Sin JWT.' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol incorrecto o sin Colaborador vinculado.',
  })
  crearPropia(
    @Body() dto: CrearSolicitudAusenciaFontaneroDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SolicitudAusenciaFontaneroResponse> {
    const usuarioId = user.idUsuario ?? Number(user.userId);
    return this.solicitudesService.crearSolicitudPropia(usuarioId, dto);
  }

  @Post(':id/documentos')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: MAX_ACTIVIDAD_DOCUMENT_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Adjuntar evidencia a una solicitud propia pendiente',
    description: 'PDF, JPG o PNG. Máximo 10 MB.',
  })
  @ApiParam({ name: 'id', description: 'ID de la solicitud', type: Number })
  adjuntarDocumento(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedImageFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const usuarioId = user.idUsuario ?? Number(user.userId);
    return this.solicitudesService.adjuntarDocumentoPropio(usuarioId, id, file);
  }

  @Get(':id/documentos/:filename')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Descargar o ver evidencia de una solicitud propia',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'filename', type: String })
  async descargarDocumento(
    @Param('id', ParseIntPipe) id: number,
    @Param('filename') filename: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const usuarioId = user.idUsuario ?? Number(user.userId);
    const { absolutePath, mimeType, documento } =
      await this.solicitudesService.obtenerArchivoDocumento(id, filename, {
        usuarioId,
      });
    return new StreamableFile(createReadStream(absolutePath), {
      type: mimeType,
      disposition: `inline; filename="${encodeURIComponent(documento.nombreOriginal)}"`,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detalle de una solicitud de ausencia propia',
    description:
      'Consulta con ownership (id + colaboradorId del usuario autenticado). ' +
      'Solicitud ajena o inexistente → 404.',
  })
  @ApiParam({ name: 'id', description: 'ID de la solicitud', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalle propio.',
    type: SolicitudAusenciaFontaneroResponse,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'ID inválido.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Sin JWT.' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol incorrecto o sin Colaborador vinculado.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Solicitud inexistente o ajena.',
  })
  obtenerPropia(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SolicitudAusenciaFontaneroResponse> {
    const usuarioId = user.idUsuario ?? Number(user.userId);
    return this.solicitudesService.obtenerSolicitudPropia(usuarioId, id);
  }
}
