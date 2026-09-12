import {
  ArgumentMetadata,
  BadRequestException,
  ParseIntPipe,
  PipeTransform,
} from '@nestjs/common';

export const AVERIA_ADMIN_INVALID_ID =
  'El identificador de la avería debe ser un número entero positivo';

/** PK real de Averia: int identity. Rechaza abc, NaN, 0 y negativos. */
export class AveriaAdminIdPipe implements PipeTransform<
  string,
  Promise<number>
> {
  private readonly parseInt = new ParseIntPipe({
    exceptionFactory: () => new BadRequestException(AVERIA_ADMIN_INVALID_ID),
  });

  async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
    const id = await this.parseInt.transform(value, metadata);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(AVERIA_ADMIN_INVALID_ID);
    }
    return id;
  }
}
