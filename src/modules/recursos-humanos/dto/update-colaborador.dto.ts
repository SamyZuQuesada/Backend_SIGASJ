import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateColaboradorDto } from './create-colaborador.dto';

export class UpdateColaboradorDto extends PartialType(
  OmitType(CreateColaboradorDto, ['usuarioId'] as const),
) {
  @ApiPropertyOptional({
    example: 5,
    nullable: true,
    description:
      'Cuenta de usuario a relacionar. Enviar null para desvincular la cuenta actual',
  })
  // `number | null` no emite metadata de tipo, así que la conversión implícita global no aplica.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  )
  @IsOptional()
  @IsInt({ message: 'El usuario debe ser un identificador numérico entero' })
  @Min(1, { message: 'El usuario debe ser un identificador válido' })
  usuarioId?: number | null;
}
