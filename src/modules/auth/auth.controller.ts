import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';
import { AuthService, AuthLoginResult } from './auth.service';
import { LoginDto } from './dto/login.dto';

/**
 * Endpoint público de autenticación.
 * Ruta final (global prefix `api/v1`): POST /api/v1/auth/login
 * Sin JwtAuthGuard / RolesGuard: no requiere sesión ni token previo.
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
}
