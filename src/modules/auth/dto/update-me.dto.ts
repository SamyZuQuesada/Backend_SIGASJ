import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const rawFromPayload = ({ value, obj, key }: TransformFnParams): unknown => {
  if (obj != null && typeof key === 'string' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return value;
};

export class UpdateMeDto {
  @ApiProperty({
    example: 'María López',
    description: 'Nombre visible del usuario autenticado',
  })
  @Transform(({ value, obj, key }) => {
    const raw = rawFromPayload({ value, obj, key } as TransformFnParams);
    return typeof raw === 'string' ? raw.trim() : raw;
  })
  @IsString({ message: 'El nombre debe ser un texto válido' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(150, { message: 'El nombre no puede superar 150 caracteres' })
  name: string;
}
