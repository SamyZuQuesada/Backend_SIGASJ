import { ApiProperty } from '@nestjs/swagger';

export class RegistroPublicoAveriaDataDto {
  @ApiProperty({
    example: 'AV-2026-0001',
    description: 'Código público único para consultar el seguimiento',
  })
  codigoSeguimiento: string;

  @ApiProperty({
    example: '2026-09-11T20:15:00.000Z',
    description: 'Fecha y hora del reporte generadas por el sistema',
  })
  fechaReporte: string;

  @ApiProperty({
    example: 'Recibida',
    description: 'Estado inicial de la avería',
  })
  estado: string;
}

export class RegistroPublicoAveriaResponseDto {
  @ApiProperty({
    example: 'Avería registrada correctamente.',
    description: 'Confirmación del registro público',
  })
  message: string;

  @ApiProperty({ type: RegistroPublicoAveriaDataDto })
  data: RegistroPublicoAveriaDataDto;
}
