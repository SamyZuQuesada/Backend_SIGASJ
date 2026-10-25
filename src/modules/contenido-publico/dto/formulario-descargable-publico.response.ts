import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Respuesta pública segura: sin paths, storage keys, timestamps ni auditoría.
 */
export class FormularioDescargablePublicoResponse {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Solicitud de nueva conexión' })
  nombre: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Utilice este formulario para solicitar una conexión nueva.',
  })
  descripcion: string | null;

  @ApiProperty({
    example: 'solicitud-conexion.pdf',
    description: 'Nombre amigable del PDF (para mostrar / Content-Disposition)',
  })
  nombreArchivoOriginal: string;

  @ApiProperty({
    example: true,
    description: 'Siempre true en el listado público (filtro Backend)',
  })
  activo: boolean;
}
