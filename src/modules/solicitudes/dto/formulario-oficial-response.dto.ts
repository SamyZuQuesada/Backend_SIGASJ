import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FormularioOficialItemDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador del tipo de trámite oficial',
  })
  tipoSolicitudId: number;

  @ApiProperty({
    example: 'Solicitud de Arreglo de Pago Domiciliar',
    description: 'Nombre oficial del trámite',
  })
  nombre: string;

  @ApiProperty({
    example: 'arreglo-pago',
    description: 'Slug oficial del trámite para enrutamiento',
  })
  slug: string;

  @ApiProperty({
    example: true,
    description: 'Indica si actualmente tiene un PDF oficial cargado y vigente',
  })
  tienePdf: boolean;

  @ApiPropertyOptional({
    example: 'Formulario_Arreglo_Pago_2026.pdf',
    description: 'Nombre original del archivo si tiene un PDF cargado',
    nullable: true,
  })
  nombreArchivo: string | null;

  @ApiPropertyOptional({
    example: 1048576,
    description: 'Tamaño del archivo en bytes si existe',
    nullable: true,
  })
  tamano: number | null;

  @ApiPropertyOptional({
    example: '2026-10-20T10:00:00.000Z',
    description: 'Fecha de última carga o reemplazo del PDF oficial',
    nullable: true,
  })
  fechaActualizacion: Date | null;

  @ApiPropertyOptional({
    example: '/solicitudes/arreglo-pago/formulario-oficial',
    description: 'Ruta relativa de descarga pública directa del PDF oficial',
    nullable: true,
  })
  urlDescarga?: string | null;
}
