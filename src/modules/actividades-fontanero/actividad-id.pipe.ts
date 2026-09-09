import { ParseIntPipe, BadRequestException } from '@nestjs/common';
import { ACTIVIDADES_MSG } from './actividades-fontanero.messages';

/** ParseIntPipe con mensaje en español para IDs de actividad. */
export const ActividadIdPipe = new ParseIntPipe({
  exceptionFactory: () => new BadRequestException(ACTIVIDADES_MSG.invalidId),
});
