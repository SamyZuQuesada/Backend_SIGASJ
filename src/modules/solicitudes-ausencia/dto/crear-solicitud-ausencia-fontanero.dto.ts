import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { TipoSolicitudAusencia } from '../../../common/enums/tipo-solicitud-ausencia.enum';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimLower = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const trimUpper = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const trimOptional = ({ value }: TransformFnParams): unknown => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class CrearSolicitudAusenciaFontaneroDto {
  @ApiProperty({
    enum: TipoSolicitudAusencia,
    example: TipoSolicitudAusencia.PERMISO,
  })
  @Transform(trimUpper)
  @IsEnum(TipoSolicitudAusencia)
  tipo!: TipoSolicitudAusencia;

  @ApiProperty({ example: '2026-11-01', description: 'YYYY-MM-DD' })
  @Transform(trimString)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaInicio debe ser YYYY-MM-DD',
  })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-11-02', description: 'YYYY-MM-DD' })
  @Transform(trimString)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaFin debe ser YYYY-MM-DD',
  })
  fechaFin!: string;

  @ApiProperty({
    example: 'fontanero@asadasanjuan.cr',
    description: 'Correo donde se avisará si la solicitud es aprobada',
  })
  @Transform(trimLower)
  @IsNotEmpty({ message: 'Indique el correo donde desea recibir el aviso' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(255, { message: 'El correo no puede superar 255 caracteres' })
  correo!: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 500,
    example: 'Cita médica',
  })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string | null;
}
