import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { OrigenIncapacidad } from '../../../common/enums/origen-incapacidad.enum';

const rawValue = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

const trimString = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  return typeof raw === 'string' ? raw.trim() : raw;
};

const trimOptionalString = (params: TransformFnParams): unknown => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== 'string') {
    return raw;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export class CreateIncapacidadDto {
  @ApiProperty({
    example: 3,
    description:
      'Identificador del colaborador al que se registra la incapacidad',
  })
  @IsInt({
    message: 'El colaborador debe ser un identificador numérico entero',
  })
  @Min(1, { message: 'El colaborador debe ser un identificador válido' })
  colaboradorId: number;

  @ApiProperty({
    example: '2026-10-12',
    description: 'Primer día del periodo de incapacidad (YYYY-MM-DD)',
  })
  @Transform(trimString)
  @IsString({ message: 'La fecha de inicio debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'La fecha de inicio debe tener formato YYYY-MM-DD',
  })
  fechaInicio: string;

  @ApiProperty({
    example: '2026-10-20',
    description: 'Último día del periodo de incapacidad (YYYY-MM-DD)',
  })
  @Transform(trimString)
  @IsString({ message: 'La fecha de fin debe ser una cadena de texto' })
  @Matches(FECHA_ISO, {
    message: 'La fecha de fin debe tener formato YYYY-MM-DD',
  })
  fechaFin: string;

  @ApiPropertyOptional({
    example: 'Documento entregado a administración',
    maxLength: 500,
    nullable: true,
    description: 'Notas administrativas opcionales (sin información médica)',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto' })
  @MaxLength(500, {
    message: 'Las observaciones no pueden exceder 500 caracteres',
  })
  observaciones?: string | null;

  @ApiPropertyOptional({
    enum: OrigenIncapacidad,
    example: OrigenIncapacidad.CCSS,
    nullable: true,
    description: 'Origen administrativo opcional',
  })
  @IsOptional()
  @IsEnum(OrigenIncapacidad, {
    message: 'El origen debe ser CCSS, INS u OTRO',
  })
  origen?: OrigenIncapacidad | null;
}
