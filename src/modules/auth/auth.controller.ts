import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuthService, AuthLoginResult, AuthLoginUser } from './auth.service';
import { LoginDto } from './dto/login.dto';

/**
 * Autenticación.
 * Prefijo global `api/v1`:
 * - POST /api/v1/auth/login (público)
 * - GET  /api/v1/auth/me (requiere JWT)
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
      'Devuelve identificador, nombre, correo y rol del usuario autenticado. ' +
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
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Sin token, token inválido o usuario inactivo' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthLoginUser> {
    const id = user?.idUsuario ?? Number(user?.userId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException('Token inválido');
    }
    return this.authService.getMe(id);
  }
}
