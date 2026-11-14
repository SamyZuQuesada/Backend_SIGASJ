import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AssistantService } from './assistant.service';
import { ChatAssistantDto } from './dto/chat-assistant.dto';

@ApiTags('Sage IA (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  Role.ADMINISTRADORA,
  Role.SECRETARIA_EJECUTIVA,
  Role.FONTANERO,
  Role.AYUDANTE,
)
@Controller('admin/assistant')
export class AdminAssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estado de Sage IA en el panel administrativo' })
  status() {
    const enabled = this.assistantService.isEnabled();
    return {
      enabled,
      mode: enabled ? 'ai' : 'demo',
      label: enabled ? 'Sage IA conectada' : 'Modo demostración',
    };
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chat de Sage IA (panel admin)',
    description:
      'Requiere sesión. Orientación de uso del panel; no consulta ni modifica registros. Claves de IA solo en backend.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Respuesta del modelo' })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'IA no configurada o no disponible',
  })
  chat(@Body() dto: ChatAssistantDto) {
    return this.assistantService.chat(dto, { surface: 'admin' });
  }
}
