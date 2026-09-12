import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EstadoSolicitudMaterial } from '../../common/enums/estado-solicitud-material.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { QuerySolicitudesMaterialDto } from './dto/query-solicitudes-material.dto';
import { RegistrarSolicitudMaterialDto } from './dto/registrar-solicitud-material.dto';
import { SolicitudMaterial } from './entities/solicitud-material.entity';
import { InventarioService } from './inventario.service';

/**
 * Controlador para la gestión de solicitudes de materiales por parte de los Fontaneros.
 *
 * Rutas expuestas:
 * - POST /api/v1/fontanero/solicitudes-materiales
 * - GET  /api/v1/fontanero/solicitudes-materiales
 * - GET  /api/v1/fontanero/solicitudes-materiales/:id
 * (con sus respectivos alias bajo /inventario/ para interoperabilidad)
 */
@ApiTags('Solicitudes de Materiales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class SolicitudesMaterialesController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Post([
    'fontanero/solicitudes-materiales',
    'inventario/solicitudes-materiales',
  ])
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Registrar solicitud de materiales (Fontanero)',
    description:
      'Permite al Fontanero autenticado registrar un pedido de materiales para su labor de campo o atención de averías. No altera las existencias físicas del inventario.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Solicitud de materiales registrada exitosamente en estado PENDIENTE',
    type: SolicitudMaterial,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Lista vacía de materiales, materiales inactivos o cantidades inválidas',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado o token JWT no provisto',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'El rol no es FONTANERO o la avería indicada no pertenece al fontanero autenticado',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Material o avería no encontrados en la base de datos',
  })
  registrarSolicitud(
    @Body() dto: RegistrarSolicitudMaterialDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SolicitudMaterial> {
    return this.inventarioService.registrarSolicitudMaterial(dto, user);
  }

  @Get([
    'fontanero/solicitudes-materiales',
    'inventario/solicitudes-materiales',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Listar solicitudes de materiales del Fontanero autenticado',
    description:
      'Devuelve el listado de pedidos de materiales registrados exclusivamente por el fontanero en sesión. Admite filtros por estado, avería y paginación.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: EstadoSolicitudMaterial,
    example: EstadoSolicitudMaterial.PENDIENTE,
  })
  @ApiQuery({ name: 'idAveria', required: false, type: Number, example: 14 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Listado de solicitudes de materiales del fontanero',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Acceso restringido al rol FONTANERO',
  })
  listarSolicitudes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QuerySolicitudesMaterialDto,
  ): Promise<any> {
    return this.inventarioService.listarSolicitudesMaterialFontanero(
      user,
      query,
    );
  }

  @Get([
    'fontanero/solicitudes-materiales/:id',
    'inventario/solicitudes-materiales/:id',
  ])
  @HttpCode(HttpStatus.OK)
  @Roles(Role.FONTANERO)
  @ApiOperation({
    summary: 'Consultar detalle de una solicitud de material (Fontanero)',
    description:
      'Retorna el detalle completo de la solicitud incluyendo ítems solicitados, cantidades e información de catálogo de materiales. No altera stock.',
  })
  @ApiParam({ name: 'id', description: 'ID de la solicitud', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalle de la solicitud de material con sus renglones',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autenticado',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'La solicitud pertenece a otro fontanero',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Solicitud no encontrada',
  })
  obtenerDetalle(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    return this.inventarioService.obtenerSolicitudMaterialFontanero(id, user);
  }
}
