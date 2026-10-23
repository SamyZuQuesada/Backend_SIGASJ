import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

/** Referencia segura a un adjunto previamente subido (upload + token). */
export class DocumentoSolicitudReferenciaDto {
  @ApiProperty({
    example: 12,
    description: 'ID devuelto por POST /solicitudes/documentos',
  })
  @Type(() => Number)
  @IsInt({ message: 'El id del documento debe ser un entero' })
  @Min(1, { message: 'El id del documento debe ser mayor que 0' })
  id: number;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Token de reclamo emitido al subir el archivo',
  })
  @IsNotEmpty({ message: 'El token de reclamo del documento es obligatorio' })
  @IsString({ message: 'El token de reclamo debe ser una cadena de texto' })
  @MaxLength(64, {
    message: 'El token de reclamo no puede exceder 64 caracteres',
  })
  tokenReclamo: string;
}
