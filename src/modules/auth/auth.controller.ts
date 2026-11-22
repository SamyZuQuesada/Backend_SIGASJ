import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UnauthorizedException,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type { UploadedImageFile } from '../../common/media/public-media';
import { AuthService, AuthLoginResult, AuthLoginUser } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';

/**
 * Autenticación.
 * Prefijo global `api/v1`:
 * - POST /api/v1/auth/login (público)
 * - GET  /api/v1/auth/me (requiere JWT)
 * - PATCH /api/v1/auth/me
 * - POST /api/v1/auth/me/password
 * - POST /api/v1/auth/me/avatar
 * - DELETE /api/v1/auth/me/avatar
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private resolveUserId(user: AuthenticatedUser): number {
    const id = user?.idUsuario ?? Number(user?.userId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException('Token inválido');
    }
    return id;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión (público)',
    description:
      'Autentica con correo y contraseña. No requiere Authorization ni sesión previa. ' +
      'Devuelve accessToken JWT y datos mínimos de usuario. Nunca incluye password ni passwordHash.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description:
      'Autenticación exitosa. JWT con `sub` = idUsuario y `role` del Rol. Sin passwordHash.',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 5,
          email: 'usuario.test@example.com',
          role: Role.FONTANERO,
          name: 'Usuario Prueba',
          avatar: null,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'LoginDto inválido (campos faltantes, formato o extras)',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas o usuario inactivo',
  })
  login(@Body() loginDto: LoginDto): Promise<AuthLoginResult> {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Usuario de la sesión actual',
    description:
      'Devuelve identificador, nombre, correo, rol y avatar del usuario autenticado. ' +
      'No acepta id por parámetros: la identidad sale del JWT. Sin password ni passwordHash.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sesión válida',
    schema: {
      example: {
        id: 5,
        email: 'usuario.test@example.com',
        role: Role.FONTANERO,
        name: 'Usuario Prueba',
        avatar: '/uploads/perfiles/foto.jpg',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Sin token, token inválido o usuario inactivo' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthLoginUser> {
    return this.authService.getMe(this.resolveUserId(user));
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Actualizar nombre del usuario autenticado',
    description:
      'Solo actualiza el nombre visible. Correo y rol no se modifican por este endpoint.',
  })
  @ApiBody({ type: UpdateMeDto })
  @ApiResponse({ status: 200, description: 'Perfil actualizado' })
  @ApiResponse({ status: 400, description: 'Nombre inválido' })
  @ApiResponse({ status: 401, description: 'Sin sesión válida' })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMeDto,
  ): Promise<AuthLoginUser> {
    return this.authService.updateMe(this.resolveUserId(user), dto);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cambiar contraseña del usuario autenticado',
    description:
      'Requiere la contraseña actual. No devuelve el hash ni la contraseña nueva.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada' })
  @ApiResponse({ status: 400, description: 'Nueva contraseña inválida' })
  @ApiResponse({
    status: 401,
    description: 'Sesión inválida o contraseña actual incorrecta',
  })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    return this.authService.changePassword(this.resolveUserId(user), dto);
  }

  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('imagen'))
  @ApiOperation({
    summary: 'Subir o reemplazar foto de perfil',
    description: 'Campo multipart `imagen`. JPG, PNG, WebP o GIF. Máx. 5 MB.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imagen: { type: 'string', format: 'binary' },
      },
      required: ['imagen'],
    },
  })
  @ApiResponse({ status: 200, description: 'Avatar actualizado' })
  @ApiResponse({ status: 400, description: 'Archivo faltante o inválido' })
  @ApiResponse({ status: 401, description: 'Sin sesión válida' })
  updateAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedImageFile,
  ): Promise<AuthLoginUser> {
    return this.authService.updateAvatar(this.resolveUserId(user), file);
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Quitar foto de perfil',
    description: 'Idempotente: si no hay foto, responde con avatar null.',
  })
  @ApiResponse({ status: 200, description: 'Avatar eliminado' })
  @ApiResponse({ status: 401, description: 'Sin sesión válida' })
  clearAvatar(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthLoginUser> {
    return this.authService.clearAvatar(this.resolveUserId(user));
  }
}
