import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { DevTokenDto } from './dto/dev-token.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión en el sistema' })
  @ApiResponse({
    status: 200,
    description: 'Autenticación exitosa y retorno de JWT',
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('dev-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Emitir JWT de desarrollo por rol (solo entornos no productivos)',
  })
  @ApiResponse({
    status: 200,
    description: 'JWT emitido para el rol solicitado',
  })
  @ApiResponse({
    status: 403,
    description: 'No disponible en producción',
  })
  devToken(@Body() devTokenDto: DevTokenDto) {
    return this.authService.devToken(devTokenDto);
  }
}
