import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Respuesta administrativa segura: sin rutas físicas absolutas ni storage secrets.
 * Omite nombreArchivoInterno (detalle de storage).
 */
export class FormularioDescargableAdminResponse {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Solicitud de nueva conexión' })
  nombre: string;

  @ApiPropertyOptional({ nullable: true })
  descripcion: string | null;

  @ApiProperty({
    example: 'solicitud-conexion.pdf',
    description: 'Nombre original del PDF (para mostrar / descarga futura)',
  })
  nombreArchivoOriginal: string;

  @ApiProperty({
    example: true,
    description: 'Visibilidad pública; inactivo no implica borrado',
  })
  activo: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Fecha de publicación oficial (independiente de createdAt)',
  })
  fechaPublicacion: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
