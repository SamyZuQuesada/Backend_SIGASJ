import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PasswordService } from './password.service';
import { hashPassword, PasswordHashingError } from './password.util';

jest.mock('./password.util', () => {
  const actual: typeof import('./password.util') =
    jest.requireActual('./password.util');
  return {
    ...actual,
    hashPassword: jest.fn((plain: string) => actual.hashPassword(plain)),
  };
});

describe('PasswordService', () => {
  const service = new PasswordService();
  const plain = 'Password123!';
  const hashPasswordMock = hashPassword as jest.MockedFunction<
    typeof hashPassword
  >;

  it('hash y compare reutilizan bcrypt y no igualan strings', async () => {
    const hash = await service.hash(plain);
    expect(hash).not.toBe(plain);
    expect(await service.compare(plain, hash)).toBe(true);
    expect(await service.compare('WrongPass1', hash)).toBe(false);
  });

  it('password vacía se rechaza sin detalle de bcrypt', async () => {
    await expect(service.hash('')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.hash('')).rejects.toThrow(
      'La contraseña no es válida.',
    );
  });

  it('error de bcrypt no expone el mensaje interno', async () => {
    hashPasswordMock.mockRejectedValueOnce(new PasswordHashingError());
    const logger = (service as unknown as { logger: Logger }).logger;
    const loggerSpy = jest
      .spyOn(logger, 'error')
      .mockImplementation(() => undefined);
    await expect(service.hash(plain)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(loggerSpy).toHaveBeenCalledWith('Error generating password hash');
    expect(JSON.stringify(loggerSpy.mock.calls)).not.toMatch(
      /Password123|salt generation/i,
    );
    loggerSpy.mockRestore();
  });
});
