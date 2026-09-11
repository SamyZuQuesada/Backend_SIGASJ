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
import type { MovimientoDocumentFile } from '../../common/media/public-media';
import { CambiarEstadoCategoriaDto } from './dto/cambiar-estado-categoria.dto';
import { CambiarEstadoMaterialDto } from './dto/cambiar-estado-material.dto';
import { CambiarEstadoProveedorDto } from './dto/cambiar-estado-proveedor.dto';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { QueryCategoriasDto } from './dto/query-categorias.dto';
import { QueryMaterialesDto } from './dto/query-materiales.dto';
import { QueryProveedoresDto } from './dto/query-proveedores.dto';
import { RegistrarEntradaDto } from './dto/registrar-entrada.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { Proveedor } from './entities/proveedor.entity';
import {
  CategoriasPaginadas,
  ConfirmacionEntradaInventario,
  InventarioService,
  MaterialesPaginados,
  ProveedoresPaginados,
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

  // =========================================================================
  // ENDPOINTS DE PROVEEDORES
  // =========================================================================

  @Post('proveedores')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Registrar un nuevo proveedor de materiales (Administradora)',
    description:
      'Crea un nuevo proveedor en el catálogo para compras y reposiciones. Requiere rol ADMINISTRADORA.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Proveedor registrado exitosamente.',
    type: Proveedor,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos inválidos o campos requeridos faltantes.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Ya existe un proveedor con el mismo nombre o identificación.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requiere rol ADMINISTRADORA.',
  })
  createProveedor(@Body() dto: CreateProveedorDto): Promise<Proveedor> {
    return this.inventarioService.createProveedor(dto);
  }

  @Get('proveedores')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary: 'Listar proveedores con paginación y filtros (Personal ASADA)',
    description:
      'Permite listar proveedores activos o inactivos, con búsqueda parcial por nombre o identificación y paginación.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado paginado de proveedores obtenido exitosamente.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol no autorizado.',
  })
  findAllProveedores(
    @Query() query: QueryProveedoresDto,
  ): Promise<ProveedoresPaginados> {
    return this.inventarioService.findAllProveedores(query);
  }

  @Get('proveedores/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar el detalle de un proveedor por ID (Personal ASADA)',
    description: 'Obtiene la información completa de un proveedor específico.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalle del proveedor obtenido exitosamente.',
    type: Proveedor,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proveedor no encontrado.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'ID inválido.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Rol no autorizado.',
  })
  findOneProveedor(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Proveedor> {
    return this.inventarioService.findOneProveedor(id);
  }

  @Patch('proveedores/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Actualizar los datos de un proveedor (Administradora)',
    description:
      'Actualiza campos comerciales, identificación o contacto de un proveedor existente.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proveedor actualizado exitosamente.',
    type: Proveedor,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Datos inválidos o ID no numérico.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proveedor no encontrado.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Colisión de nombre o identificación con otro proveedor.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requiere rol ADMINISTRADORA.',
  })
  updateProveedor(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProveedorDto,
  ): Promise<Proveedor> {
    return this.inventarioService.updateProveedor(id, dto);
  }

  @Patch('proveedores/:id/estado')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary: 'Activar o desactivar un proveedor (Administradora)',
    description:
      'Cambia el estado operativo de un proveedor sin eliminarlo físicamente, preservando el histórico.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estado del proveedor actualizado exitosamente.',
    type: Proveedor,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'El estado enviado es inválido.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Proveedor no encontrado.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requiere rol ADMINISTRADORA.',
  })
  cambiarEstadoProveedor(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoProveedorDto,
  ): Promise<Proveedor> {
    return this.inventarioService.cambiarEstadoProveedor(id, dto.activo);
  }

  @Post('entradas')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @ApiOperation({
    summary:
      'Registrar una entrada física de materiales a bodega (Administradora)',
    description:
      'Aumenta atómicamente la existencia física disponible del material y genera el registro en MovimientoInventario con trazabilidad del responsable y motivo.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Entrada registrada con éxito, existencias actualizadas y movimiento generado.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Datos inválidos (cantidad menor o igual a 0, material inactivo, proveedor inactivo).',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Material o Proveedor no encontrado.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Requiere rol ADMINISTRADORA.',
  })
  registrarEntrada(
    @Body() dto: RegistrarEntradaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConfirmacionEntradaInventario> {
    return this.inventarioService.registrarEntrada(dto, user);
  }

  @Post('movimientos/:id/documentos')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Adjuntar documento de respaldo a un movimiento de inventario (Administradora)',
    description:
      'Permite adjuntar facturas, recibos, guías de entrega o comprobantes (PDF, JPG, PNG, WebP) de hasta 10 MB.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Documento adjuntado exitosamente al movimiento.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Archivo no proporcionado, tamaño superior a 10 MB o formato no permitido.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Movimiento no encontrado.',
  })
  adjuntarDocumentoMovimiento(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MovimientoDocumentFile,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentoMovimientoInventario> {
    return this.inventarioService.adjuntarDocumentoMovimiento(id, file, user);
  }

  @Post('entradas/:id/documentos')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA)
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Adjuntar documento de respaldo a una entrada de inventario (Administradora)',
    description:
      'Alias para adjuntar facturas, recibos o comprobantes a una entrada de bodega.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Documento adjuntado exitosamente a la entrada.',
  })
  adjuntarDocumentoEntrada(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: MovimientoDocumentFile,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentoMovimientoInventario> {
    return this.inventarioService.adjuntarDocumentoMovimiento(id, file, user);
  }

  @Get('movimientos/:id/documentos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary: 'Listar documentos de respaldo asociados a un movimiento de inventario',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de documentos asociados al movimiento.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Movimiento no encontrado.',
  })
  listarDocumentosMovimiento(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DocumentoMovimientoInventario[]> {
    return this.inventarioService.listarDocumentosMovimiento(id);
  }

  @Get('entradas/:id/documentos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary: 'Listar documentos de respaldo asociados a una entrada de inventario',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de documentos asociados a la entrada.',
  })
  listarDocumentosEntrada(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DocumentoMovimientoInventario[]> {
    return this.inventarioService.listarDocumentosMovimiento(id);
  }

  @Get('movimientos/:id/documentos/:filename')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary:
      'Descargar o visualizar un documento de respaldo de un movimiento de inventario',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transmisión segura del archivo solicitado.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Documento o archivo físico no encontrado.',
  })
  async descargarDocumentoMovimiento(
    @Param('id', ParseIntPipe) id: number,
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    const { absolutePath, mimeType, documento } =
      await this.inventarioService.obtenerArchivoDocumento(id, filename);

    return new StreamableFile(createReadStream(absolutePath), {
      type: mimeType,
      disposition: `inline; filename="${encodeURIComponent(documento.nombreOriginal)}"`,
    });
  }

  @Get('entradas/:id/documentos/:filename')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMINISTRADORA, Role.SECRETARIA, Role.FONTANERO)
  @ApiOperation({
    summary:
      'Descargar o visualizar un documento de respaldo de una entrada de inventario',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transmisión segura del archivo solicitado.',
  })
  descargarDocumentoEntrada(
    @Param('id', ParseIntPipe) id: number,
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    return this.descargarDocumentoMovimiento(id, filename);
  }
}

