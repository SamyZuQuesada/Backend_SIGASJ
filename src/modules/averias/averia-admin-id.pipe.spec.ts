import { BadRequestException } from '@nestjs/common';
import {
  AVERIA_ADMIN_INVALID_ID,
  AveriaAdminIdPipe,
} from './averia-admin-id.pipe';

describe('AveriaAdminIdPipe', () => {
  const pipe = new AveriaAdminIdPipe();
  const metadata = { type: 'param', data: 'id', metatype: Number } as const;

  it('acepta enteros positivos', async () => {
    await expect(pipe.transform('25', metadata)).resolves.toBe(25);
    await expect(pipe.transform('1', metadata)).resolves.toBe(1);
  });

  it('rechaza formato inválido, 0 y negativos', async () => {
    for (const value of ['abc', '12.5', '0', '-1', '']) {
      await expect(pipe.transform(value, metadata)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(pipe.transform(value, metadata)).rejects.toMatchObject({
        message: AVERIA_ADMIN_INVALID_ID,
      });
    }
  });
});
