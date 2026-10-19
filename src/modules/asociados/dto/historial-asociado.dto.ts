import { ApiProperty } from '@nestjs/swagger';

/**
 * Representa un registro del historial de asociados (activos o inactivos).
 */
export class HistorialAsociadoItemDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del asociado',
  })
  id: number;

  @ApiProperty({
    example: 'Juan',
    description: 'Nombre de pila del asociado',
  })
  nombre: string;

  @ApiProperty({
    example: 'Pérez Rodríguez',
    description: 'Apellidos del asociado',
  })
  apellidos: string;

  @ApiProperty({
    example: '1-1234-0567',
    description: 'Cédula o documento de identidad único',
  })
  cedula: string;

  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'Correo electrónico de contacto del asociado',
  })
  correo: string;

  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'Correo electrónico canónico del asociado',
  })
  correoElectronico: string;

  @ApiProperty({
    example: true,
    description:
      'Estado booleano de afiliación (true = activo, false = inactivo)',
  })
  activo: boolean;

  @ApiProperty({
    example: 'Activo',
    description: 'Estado descriptivo del asociado (Activo o Inactivo)',
    enum: ['Activo', 'Inactivo'],
  })
  estado: 'Activo' | 'Inactivo';

  @ApiProperty({
    example: '2026-01-15T08:00:00.000Z',
    description:
      'Fecha en la que el asociado fue registrado formalmente en la ASADA',
  })
  fechaRegistro: Date;

  @ApiProperty({
    example: null,
    nullable: true,
    description:
      'Fecha en la que el asociado fue inactivado. Es null mientras permanezca activo',
  })
  fechaInactivacion: Date | null;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'Motivo por el cual el asociado fue inactivado (si aplica)',
  })
  motivoInactivacion: string | null;
}

/**
 * Respuesta estructurada y paginada del historial administrativo de asociados.
 */
export class HistorialAsociadosResponseDto {
  @ApiProperty({
    type: [HistorialAsociadoItemDto],
    description: 'Listado de asociados (activos e inactivos)',
  })
  data: HistorialAsociadoItemDto[];

  @ApiProperty({
    example: 25,
    description: 'Cantidad total de registros encontrados',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Número de página actual',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Cantidad de registros por página',
  })
  limit: number;

  @ApiProperty({
    example: 3,
    description: 'Cantidad total de páginas disponibles',
  })
  totalPages: number;
}
