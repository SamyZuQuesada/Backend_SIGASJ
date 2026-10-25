import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  Allow,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TipoSolicitudAusencia } from '../../../common/enums/tipo-solicitud-ausencia.enum';
import { MAX_CORREOS_AVISO_LENGTH, normalizarCorreosAviso } from '../correos-aviso.util';
import { IsListaCorreosAviso } from '../is-lista-correos-aviso.validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

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
    example: 'fontanero@asadasanjuan.cr, jefe@asadasanjuan.cr',
    description:
      'Uno o más correos (coma, punto y coma o espacio) donde se avisará si la solicitud es aprobada',
  })
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? normalizarCorreosAviso(value) : value,
  )
  @IsNotEmpty({ message: 'Indique el correo donde desea recibir el aviso' })
  @IsListaCorreosAviso()
  @MaxLength(MAX_CORREOS_AVISO_LENGTH, {
    message: 'Los correos de aviso no pueden superar 500 caracteres',
  })
  correo!: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 500,
    example: 'Cita médica',
  })
  @Transform(trimOptional)
  @ValidateIf(
    (dto: CrearSolicitudAusenciaFontaneroDto) =>
      dto.tipo === TipoSolicitudAusencia.PERMISO,
  )
  @IsNotEmpty({ message: 'Indique el motivo del permiso' })
  @IsString()
  @MaxLength(500)
  motivo?: string | null;

  @Allow()
  documentos?: unknown;
}
