import { PartialType } from '@nestjs/swagger';
import { CreateIncapacidadDto } from './create-incapacidad.dto';

export class UpdateIncapacidadDto extends PartialType(CreateIncapacidadDto) {}
