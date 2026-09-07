import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ActividadesFontaneroService } from './actividades-fontanero.service';
import { CorregirActividadDto } from './dto/corregir-actividad.dto';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { RevisarActividadDto } from './dto/revisar-actividad.dto';
import { SolicitarCorreccionDto } from './dto/solicitar-correccion.dto';
import { UploadedImageFile } from '../../common/media/public-media';

@ApiTags('Actividades Fontanero')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ActividadesFontaneroController {
  constructor(
    private readonly actividadesFontaneroService: ActividadesFontaneroService,
  ) {}

  // ── Fontanero ────────────────────────────────────────────────────────────

  @Post('fontanero/actividades')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Registrar una actividad propia (Fontanero)',
  })
  registrar(
    @Body() dto: CreateActividadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.registrar(dto, user);
  }

  @Get('fontanero/actividades')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Listar actividades propias (Fontanero)',
  })
  listarPropias(@CurrentUser() user: AuthenticatedUser) {
    return this.actividadesFontaneroService.listarPropias(user);
  }

  @Get('fontanero/actividades/historial')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar historial propio (Fontanero)',
  })
  historialPropio(@CurrentUser() user: AuthenticatedUser) {
    return this.actividadesFontaneroService.historialPropio(user);
  }

  @Get('fontanero/actividades/correcciones')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar correcciones pendientes propias (Fontanero)',
  })
  correccionesPendientes(@CurrentUser() user: AuthenticatedUser) {
    return this.actividadesFontaneroService.correccionesPendientes(user);
  }

  @Get('fontanero/actividades/tipos')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO, Role.ADMINISTRADORA)
  @ApiOperation({
    summary:
      'Consultar catálogo de tipos de actividad (Fontanero y Administradora)',
  })
  listarTipos() {
    return this.actividadesFontaneroService.listarTipos();
  }

  @Get('fontanero/actividades/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar detalle de una actividad propia (Fontanero)',
  })
  detallePropio(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.detallePropio(id, user);
  }

  @Post('fontanero/actividades/:id/documentos')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.FONTANERO)
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Adjuntar documento a una actividad propia (Fontanero)',
  })
  adjuntarDocumento(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedImageFile,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.adjuntarDocumento(
      id,
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      user,
    );
  }

  @Patch('fontanero/actividades/:id/corregir')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Corregir y reenviar una actividad propia (Fontanero)',
  })
  corregirPropia(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CorregirActividadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.corregirPropia(id, dto, user);
  }

  // ── Administradora ───────────────────────────────────────────────────────

  @Get('admin/actividades')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Listar actividades reportadas (Administradora)',
  })
  listarAdmin() {
    return this.actividadesFontaneroService.listarAdmin();
  }

  @Get('admin/actividades/historial')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Consultar historial de actividades (Administradora)',
  })
  historialAdmin() {
    return this.actividadesFontaneroService.historialAdmin();
  }

  @Get('admin/actividades/reportes')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Consultar reportes agregados de actividades (Administradora)',
  })
  reportesAdmin() {
    return this.actividadesFontaneroService.reportesAdmin();
  }

  @Get('admin/actividades/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Consultar detalle de una actividad (Administradora)',
  })
  detalleAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.actividadesFontaneroService.detalleAdmin(id);
  }

  @Patch('admin/actividades/:id/revisar')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Revisar una actividad reportada (Administradora)',
  })
  revisar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevisarActividadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.revisar(id, dto, user);
  }

  @Patch('admin/actividades/:id/solicitar-correccion')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Solicitar corrección de una actividad (Administradora)',
  })
  solicitarCorreccion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SolicitarCorreccionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actividadesFontaneroService.solicitarCorreccion(id, dto, user);
  }
}
