import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatAssistantDto } from './dto/chat-assistant.dto';

type AssistantConfig = {
  enabled: boolean;
  provider: 'openai' | 'azure';
  apiKey: string;
  model: string;
  openaiBaseUrl: string;
  azureEndpoint: string;
  azureDeployment: string;
  azureApiVersion: string;
  timeoutMs: number;
  maxTokens: number;
};

const PUBLIC_SYSTEM_PROMPT = `Eres el asistente virtual oficial de SIGASJ, la plataforma de la ASADA San Juan de Santa Cruz (Guanacaste, Costa Rica).

Reglas:
- Responde siempre en español claro y breve (máximo 120 palabras).
- Solo orientas sobre servicios de la ASADA: recibos, pagos (SINPE 8560-7584, Banco Nacional, ventanilla), averías, trámites, comunicados, transparencia, contacto y horarios.
- Horario típico: lunes a sábado, 7:00 a.m. a 11:30 a.m.
- Contacto: WhatsApp/teléfono 8560-7584, correo asadasanjuan24@gmail.com.
- No inventes datos de abonados, montos, cédulas ni estados de solicitudes.
- No des consejos legales/médicos. Si no sabes, indica ir a Contacto o WhatsApp.
- Puedes sugerir secciones del sitio: #pagos, #solicitudes-servicio, #comunicados, #transparencia, #contacto, /reportar-averia, /login.
- Sé cordial y cercano a la comunidad.`;

const ADMIN_SYSTEM_PROMPT = `Eres Sage IA, asistente de orientación del panel administrativo SIGASJ (ASADA San Juan).

Reglas estrictas:
- Responde en español claro y breve (máximo 140 palabras).
- Solo ayudas a entender pantallas, flujos y pasos de uso del panel (dashboard, asociados, solicitudes, averías, inventario, actividades, RRHH, proyectos, galería, comunicados, etc.).
- Nunca inventes datos de la base (asociados, averías, stock, montos, estados). No digas que consultaste registros.
- No ejecutes ni simules cambios: no creas, editas ni eliminas nada. No pidas contraseñas ni secretos.
- Respeta que el usuario solo ve lo que su rol permite; no indiques atajos para saltarse permisos.
- Si falta contexto, explica dónde buscar en la interfaz o qué botón/módulo usar.
- Sé cordial y profesional.`;

export type AssistantChatSurface = 'public' | 'admin';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return Boolean(this.configService.get<AssistantConfig>('assistant')?.enabled);
  }

  async chat(
    dto: ChatAssistantDto,
    options: { surface?: AssistantChatSurface } = {},
  ): Promise<{
    reply: string;
    provider: string;
    source: 'ai';
  }> {
    const cfg = this.configService.get<AssistantConfig>('assistant');
    if (!cfg?.enabled || !cfg.apiKey) {
      throw new ServiceUnavailableException(
        'El asistente con IA no está configurado. Defina OPENAI_API_KEY o AZURE_OPENAI_*.',
      );
    }

    const surface = options.surface ?? 'public';
    const moduleHint = dto.modulePath?.trim()
      ? `\nMódulo actual del usuario: ${dto.modulePath.trim()}`
      : '';
    const systemPrompt =
      surface === 'admin'
        ? `${ADMIN_SYSTEM_PROMPT}${moduleHint}`
        : PUBLIC_SYSTEM_PROMPT;

    const url =
      cfg.provider === 'azure'
        ? `${cfg.azureEndpoint}/openai/deployments/${encodeURIComponent(cfg.azureDeployment)}/chat/completions?api-version=${encodeURIComponent(cfg.azureApiVersion)}`
        : `${cfg.openaiBaseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cfg.provider === 'azure') {
      headers['api-key'] = cfg.apiKey;
    } else {
      headers.Authorization = `Bearer ${cfg.apiKey}`;
    }

    const history = (dto.history ?? []).slice(-8).map((item) => ({
      role: item.role,
      content: item.content,
    }));

    const body = {
      ...(cfg.provider === 'openai' ? { model: cfg.model } : {}),
      temperature: 0.3,
      max_tokens: cfg.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: dto.message.trim() },
      ],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = await response.text();
      if (!response.ok) {
        this.logger.warn(
          `Asistente IA HTTP ${response.status}: ${raw.slice(0, 200)}`,
        );
        throw new ServiceUnavailableException(
          'No se pudo obtener respuesta del modelo de IA.',
        );
      }
      const json = JSON.parse(raw) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = json.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        throw new ServiceUnavailableException(
          'El modelo de IA devolvió una respuesta vacía.',
        );
      }
      return { reply, provider: cfg.provider, source: 'ai' };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn(
        `Asistente IA falló: ${error instanceof Error ? error.message : 'error'}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo contactar al servicio de IA.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
