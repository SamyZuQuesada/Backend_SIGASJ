import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoSolicitud } from '../../../common/enums/estado-solicitud.enum';

const trimOpcional = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Datos controlables por el cliente autorizado al cambiar estado.
 * NO incluir: usuarioId/idUsuario, estadoAnterior, fecha, solicitudId
 * (los controla el Backend desde JWT / BD / servidor).
 */
export class CambiarEstadoSolicitudDto {
  @ApiProperty({
    enum: EstadoSolicitud,
    example: EstadoSolicitud.EN_REVISION,
    description: 'Nuevo estado oficial del ciclo de vida de la solicitud',
  })
  @IsEnum(EstadoSolicitud, {
    message: `estadoNuevo debe ser uno de: ${Object.values(EstadoSolicitud).join(', ')}`,
  })
  estadoNuevo!: EstadoSolicitud;

  @ApiPropertyOptional({
    example: 'Su solicitud requiere una corrección.',
    maxLength: 1000,
    description:
      'Mensaje potencialmente visible al solicitante. Independiente de notaInterna.',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimOpcional)
  @IsString()
  @MaxLength(1000)
  observacionPublica?: string | null;

  @ApiPropertyOptional({
    example: 'El plano aportado presenta información ilegible.',
    maxLength: 1000,
    description:
      'Nota administrativa interna (ADMIN ONLY). Independiente de observacionPublica.',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimOpcional)
  @IsString()
  @MaxLength(1000)
  notaInterna?: string | null;
}
