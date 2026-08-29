import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import type { UploadedImageFile } from '../../common/media/public-media';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { CreateProyectoImagenDto } from './dto/create-proyecto-imagen.dto';
import { QueryProyectosAdminDto } from './dto/query-proyectos-admin.dto';
import { ReordenarImagenesDto } from './dto/reordenar-imagenes.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { UpdateProyectoEstadoDto } from './dto/update-proyecto-estado.dto';
import { UpdateProyectoVisibilidadDto } from './dto/update-proyecto-visibilidad.dto';
import { ProyectosService } from './proyectos.service';



@ApiTags('Proyectos')
@Controller()
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Get('public/proyectos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Listar proyectos activos para las Cards de vista pública (Público)',
  })
  findAllPublic() {
    return this.proyectosService.findAllPublic();
  }

  @Get('admin/proyectos')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Listar proyectos administrativos (Administradora)',
  })
  findAllAdmin(@Query() query: QueryProyectosAdminDto) {
    return this.proyectosService.findAllAdmin(query);
  }

  @Get('admin/proyectos/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Obtener detalle de un proyecto (Administradora)',
  })
  findOneAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.proyectosService.findOneAdmin(id);
  }

  @Post('admin/proyectos')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @UseInterceptors(FileInterceptor('imagenPrincipal'))
  @ApiOperation({
    summary: 'Registrar un proyecto con imagen principal opcional (Administradora)',
  })
  create(
    @Body() dto: CreateProyectoDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.proyectosService.create(dto, user, file);
  }

  @Patch('admin/proyectos/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @UseInterceptors(FileInterceptor('imagenPrincipal'))
  @ApiOperation({
    summary: 'Actualizar proyecto / reemplazar o quitar imagen principal (Administradora)',
  })
  updateAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProyectoDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.proyectosService.updateAdmin(id, dto, user, file);
  }

  @Patch('admin/proyectos/:id/estado')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Actualizar el estado del ciclo de ejecución de un proyecto (Administradora)',
  })
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProyectoEstadoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proyectosService.updateEstado(id, dto, user);
  }

  @Patch('admin/proyectos/:id/visibilidad')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Actualizar la visibilidad pública (activo/inactivo) de un proyecto (Administradora)',
  })
  updateVisibilidad(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProyectoVisibilidadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proyectosService.updateVisibilidad(id, dto, user);
  }



  @Post('admin/proyectos/:id/imagen-principal')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @UseInterceptors(FileInterceptor('imagenPrincipal'))
  @ApiOperation({
    summary: 'Asignar o reemplazar la imagen principal de un proyecto (Administradora)',
  })
  updateImagenPrincipal(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.proyectosService.updateImagenPrincipal(id, file);
  }

  @Delete('admin/proyectos/:id/imagen-principal')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Eliminar la imagen principal de un proyecto (Administradora)',
  })
  removeImagenPrincipal(@Param('id', ParseIntPipe) id: number) {
    return this.proyectosService.removeImagenPrincipal(id);
  }

  @Post('admin/proyectos/:id/imagenes')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @UseInterceptors(FileInterceptor('imagen'))
  @ApiOperation({
    summary: 'Agregar una fotografía a la galería del proyecto (Administradora)',
  })
  addImagenGaleria(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProyectoImagenDto,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.proyectosService.addImagenGaleria(id, dto, file);
  }

  @Delete('admin/proyectos/:id/imagenes/:imagenId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Eliminar una fotografía de la galería del proyecto (Administradora)',
  })
  removeImagenGaleria(
    @Param('id', ParseIntPipe) id: number,
    @Param('imagenId', ParseIntPipe) imagenId: number,
  ) {
    return this.proyectosService.removeImagenGaleria(id, imagenId);
  }

  @Patch('admin/proyectos/:id/imagenes/orden')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Reordenar las fotografías de la galería del proyecto (Administradora)',
  })
  reordenarImagenesGaleria(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReordenarImagenesDto,
  ) {
    return this.proyectosService.reordenarImagenesGaleria(id, dto);
  }
}

