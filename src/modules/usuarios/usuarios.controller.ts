import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Obtener lista de usuarios del sistema',
    description:
      'Solo Super Admin. Devuelve `{ data: [{ id, nombre, correo, activo, rol }] }`. El rol es el valor de `Role` persistido en Rol (p. ej. SUPER_ADMIN, ADMINISTRADORA, SECRETARIA, FONTANERO). No incluye passwordHash ni secretos.',
  })
  findAll() {
    return this.usuariosService.findAll();
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Crear un usuario del sistema',
    description:
      'Solo Super Admin. Hashea la contraseña con el servicio centralizado y persiste solo passwordHash. La respuesta no incluye el hash ni la contraseña.',
  })
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.crear(dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Actualizar un usuario del sistema',
    description:
      'Solo Super Admin. Si se envía password, se genera un hash nuevo. Si no se envía, el hash existente no se modifica. No permite dejar el sistema sin Super Admin activo. La respuesta no incluye passwordHash.',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.usuariosService.actualizar(id, dto);
  }
}
