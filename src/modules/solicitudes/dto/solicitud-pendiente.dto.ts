import { ApiProperty } from '@nestjs/swagger';

export class SolicitudPendienteDto {
  @ApiProperty({ example: 1 })
  idSolicitud: number;

  @ApiProperty({ example: 'María' })
  nombre: string;

  @ApiProperty({ example: 'Rodríguez Mora' })
  apellidos: string;

  @ApiProperty({ example: '1-2345-6789' })
  cedula: string;

  @ApiProperty({ example: '8888-1234' })
  telefono: string;

  @ApiProperty({ example: 'maria.rodriguez@correo.cr' })
  correo: string;

  @ApiProperty({ example: 'San Juan, Desamparados' })
  direccion: string;

  @ApiProperty({
    example: false,
    description: 'Indica si la solicitud ya fue procesada/utilizada',
  })
  utilizada: boolean;
}
