import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssistantHistoryItemDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1200)
  content!: string;
}

export class ChatAssistantDto {
  @ApiProperty({
    description: 'Pregunta del usuario de la comunidad',
    example: '¿Cómo pago el recibo con SINPE?',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  message!: string;

  @ApiPropertyOptional({ type: [AssistantHistoryItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => AssistantHistoryItemDto)
  history?: AssistantHistoryItemDto[];

  @ApiPropertyOptional({
    description: 'Ruta del módulo administrativo actual (solo panel Sage IA)',
    example: '/admin/averias',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  modulePath?: string;
}
