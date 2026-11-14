import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AssistantService } from './assistant.service';
import { ChatAssistantDto } from './dto/chat-assistant.dto';

@ApiTags('Asistente público')
@Controller('public/assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Indica si la IA del asistente está habilitada' })
  status() {
    return {
      enabled: this.assistantService.isEnabled(),
      mode: this.assistantService.isEnabled() ? 'ai' : 'local-fallback',
    };
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chat del asistente comunitario (IA)',
    description:
      'Endpoint público. Requiere OPENAI_API_KEY o configuración Azure OpenAI en el backend.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Respuesta del modelo' })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'IA no configurada o no disponible',
  })
  chat(@Body() dto: ChatAssistantDto) {
    return this.assistantService.chat(dto);
  }
}
