import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReciboItemDto {
  @ApiPropertyOptional({ description: 'Fecha de emisión del recibo', example: '2026-08-01' })
  fechaEmision?: string;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento del recibo', example: '2026-08-20' })
  fechaVencimiento?: string;

  @ApiPropertyOptional({ description: 'Monto total a pagar', example: 12500 })
  total?: number;

  @ApiPropertyOptional({ description: 'Periodo o mes cobrado', example: 'Agosto 2026' })
  periodo?: string;

  [key: string]: any;
}

export class ReciboDataDto {
  @ApiProperty({ description: 'Número de paja consultado', example: 130 })
  numeroPaja!: number;

  @ApiProperty({ description: 'Nombre completo del abonado', example: 'MARCO ANTONIO CABALCETA JIMENEZ' })
  abonado!: string;

  @ApiProperty({ description: 'Indica si el abonado tiene recibos pendientes de pago', example: false })
  tieneRecibosPendientes!: boolean;

  @ApiPropertyOptional({ description: 'Mensaje descriptivo retornado por la consulta', example: 'No existen recibos pendientes para el abonado' })
  mensaje?: string;

  @ApiProperty({ description: 'Lista de recibos pendientes', type: [ReciboItemDto] })
  recibos!: ReciboItemDto[];
}

export class ReciboConsultaResponseDto {
  @ApiProperty({ description: 'Indica el éxito de la operación', example: true })
  success!: boolean;

  @ApiPropertyOptional({ description: 'Datos del recibo y abonado', type: ReciboDataDto })
  data?: ReciboDataDto;

  @ApiPropertyOptional({ description: 'Mensaje de error en caso de fallo', example: 'La paja consultada no existe' })
  error?: string;
}
