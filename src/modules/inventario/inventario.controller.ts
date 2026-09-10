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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CambiarEstadoCategoriaDto } from './dto/cambiar-estado-categoria.dto';
import { CambiarEstadoMaterialDto } from './dto/cambiar-estado-material.dto';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { QueryCategoriasDto } from './dto/query-categorias.dto';
import { QueryMaterialesDto } from './dto/query-materiales.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { Material } from './entities/material.entity';
import {
  CategoriasPaginadas,
  InventarioService,
  MaterialesPaginados,
} from './inventario.service';

@ApiTags('Inventario')
@ApiBearerAuth()
@Controller('inventario')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Post('materiales')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary:
      'Registrar un nuevo material en el catálogo de inventario (Administradora)',
    description:
      'Crea un nuevo artículo en el catálogo de bodega con stockActual en 0. Requiere rol de Administradora.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'El material fue registrado exitosamente en el catálogo.',
    type: Material,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos de entrada inválidos o faltantes.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ya existe un material registrado con ese nombre.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado. Token JWT ausente o inválido.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Acceso denegado. Se requiere rol ADMINISTRADORA.',
  })
  create(@Body() dto: CreateMaterialDto): Promise<Material> {
    return this.inventarioService.create(dto);
  }

  @Get('materiales')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar listado ordenado y paginado de materiales',
    description:
      'Retorna el catálogo de materiales con paginación, búsqueda por nombre y filtro de activos/inactivos.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado de materiales obtenido exitosamente.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado. Token JWT ausente o inválido.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Acceso denegado. Rol no autorizado.',
  })
  findAll(@Query() query: QueryMaterialesDto): Promise<MaterialesPaginados> {
    return this.inventarioService.findAll(query);
  }

  @Get('materiales/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar detalle completo de un material por ID',
    description:
      'Retorna la información completa de un material registrado. Utilizado para consultas operativas y recarga de formularios de edición.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalle del material obtenido exitosamente.',
    type: Material,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Identificador de material inválido.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Material no encontrado.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado. Token JWT ausente o inválido.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Acceso denegado. Rol no autorizado.',
  })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Material> {
    return this.inventarioService.findOne(id);
  }

  @Put('materiales/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary:
      'Actualizar completamente los datos de un material (Administradora)',
    description:
      'Actualiza los campos descriptivos y administrativos de un material existente. Las existencias no pueden modificarse desde aquí.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Material actualizado exitosamente.',
    type: Material,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos de entrada inválidos.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Material no encontrado.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ya existe otro material con ese nombre.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requiere rol ADMINISTRADORA.',
  })
  updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaterialDto,
  ): Promise<Material> {
    return this.inventarioService.update(id, dto);
  }

  @Patch('materiales/:id/estado')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Activar o desactivar un material en el catálogo (Administradora)',
    description:
      'Cambia el estado operativo de un material (Activo / Inactivo) sin eliminarlo físicamente de la base de datos, preservando su trazabilidad histórica.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estado del material actualizado exitosamente.',
    type: Material,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos de entrada o identificador inválidos.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Material no encontrado.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requiere rol ADMINISTRADORA.',
  })
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoMaterialDto,
  ): Promise<Material> {
    return this.inventarioService.cambiarEstado(id, dto.activo);
  }

  @Patch('materiales/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary:
      'Actualizar parcialmente los datos de un material (Administradora)',
    description:
      'Actualiza uno o varios campos descriptivos de un material existente. Las existencias no pueden modificarse desde aquí.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Material actualizado exitosamente.',
    type: Material,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos de entrada inválidos.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Material no encontrado.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ya existe otro material con ese nombre.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requiere rol ADMINISTRADORA.',
  })
  updatePatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaterialDto,
  ): Promise<Material> {
    return this.inventarioService.update(id, dto);
  }

  /* =========================================================================
   * ENDPOINTS: CATEGORÍAS DE MATERIALES
   * ========================================================================= */

  @Post('categorias')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Registrar una nueva categoría de materiales (Administradora)',
    description:
      'Crea una nueva categoría para agrupar materiales de bodega. Requiere rol de Administradora.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'La categoría fue registrada exitosamente.',
    type: CategoriaMaterial,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos de entrada inválidos o faltantes.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ya existe una categoría registrada con ese nombre.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requiere rol ADMINISTRADORA.',
  })
  createCategoria(@Body() dto: CreateCategoriaDto): Promise<CategoriaMaterial> {
    return this.inventarioService.createCategoria(dto);
  }

  @Get('categorias')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar catálogo de categorías de materiales',
    description:
      'Retorna el listado paginado de categorías con opción de búsqueda por nombre y filtro por estado activo.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado de categorías obtenido exitosamente.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol no autorizado para consultar inventario.',
  })
  findAllCategorias(
    @Query() query: QueryCategoriasDto,
  ): Promise<CategoriasPaginadas> {
    return this.inventarioService.findAllCategorias(query);
  }

  @Get('categorias/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary: 'Obtener detalle de una categoría por ID',
    description:
      'Retorna la información descriptiva y estado de una categoría registrada.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categoría encontrada.',
    type: CategoriaMaterial,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'El ID de la categoría debe ser numérico.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Categoría no encontrada.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol no autorizado.',
  })
  findOneCategoria(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CategoriaMaterial> {
    return this.inventarioService.findOneCategoria(id);
  }

  @Put('categorias/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Actualizar datos de una categoría (PUT - Administradora)',
    description:
      'Modifica el nombre o la descripción de una categoría existente.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categoría actualizada exitosamente.',
    type: CategoriaMaterial,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos de entrada inválidos.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Categoría no encontrada.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ya existe otra categoría registrada con ese nombre.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requiere rol ADMINISTRADORA.',
  })
  updateCategoriaPut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
  ): Promise<CategoriaMaterial> {
    return this.inventarioService.updateCategoria(id, dto);
  }

  @Patch('categorias/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Actualizar datos de una categoría (PATCH - Administradora)',
    description:
      'Modifica parcialmente los datos descriptivos de una categoría.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categoría actualizada exitosamente.',
    type: CategoriaMaterial,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos de entrada inválidos.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Categoría no encontrada.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ya existe otra categoría registrada con ese nombre.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requiere rol ADMINISTRADORA.',
  })
  updateCategoriaPatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
  ): Promise<CategoriaMaterial> {
    return this.inventarioService.updateCategoria(id, dto);
  }

  @Patch('categorias/:id/estado')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Activar o desactivar una categoría (Administradora)',
    description:
      'Cambia el estado operativo de una categoría sin eliminarla físicamente, preservando el histórico.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estado de la categoría actualizado exitosamente.',
    type: CategoriaMaterial,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'El estado enviado es inválido.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Categoría no encontrada.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requiere rol ADMINISTRADORA.',
  })
  cambiarEstadoCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoCategoriaDto,
  ): Promise<CategoriaMaterial> {
    return this.inventarioService.cambiarEstadoCategoria(id, dto.activo);
  }
}
