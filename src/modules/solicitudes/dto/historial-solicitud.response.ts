import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoSolicitud } from '../../../common/enums/estado-solicitud.enum';
import { Role } from '../../../common/enums/role.enum';

/**
 * Responsable administrativo del evento (sin correo ni password).
 */
export class HistorialSolicitudUsuarioDto {
  @ApiProperty({ example: 7 })
  idUsuario!: number;

  @ApiProperty({ example: 'María Rodríguez' })
  nombre!: string;

  @ApiPropertyOptional({
    enum: Role,
    example: Role.ADMINISTRADORA,
    description: 'Nombre del rol si está cargado (valor de Role)',
    nullable: true,
  })
  rol!: string | null;
}

/**
 * Evento de HistorialSolicitud para timeline administrativa.
 * notaInterna = ADMIN ONLY (este DTO no debe reutilizarse en endpoints públicos).
 */
export class HistorialSolicitudItemDto {
  @ApiProperty({ example: 41 })
  id!: number;

  @ApiProperty({ example: 12 })
  solicitudId!: number;

  @ApiProperty({
    enum: EstadoSolicitud,
    nullable: true,
    description: 'Null en el evento de creación',
  })
  estadoAnterior!: EstadoSolicitud | null;

  @ApiProperty({ enum: EstadoSolicitud })
  estadoNuevo!: EstadoSolicitud;

  @ApiPropertyOptional({ nullable: true })
  observacionPublica!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Solo contexto administrativo',
  })
  notaInterna!: string | null;

  @ApiPropertyOptional({ nullable: true })
  idUsuario!: number | null;

  @ApiPropertyOptional({
    type: HistorialSolicitudUsuarioDto,
    nullable: true,
  })
  usuario!: HistorialSolicitudUsuarioDto | null;

  @ApiProperty()
  fecha!: Date;
}
