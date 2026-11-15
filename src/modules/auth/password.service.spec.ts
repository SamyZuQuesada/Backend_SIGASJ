import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from './password.service';
import * as passwordUtil from './password.util';

const PASSWORD_SINTETICA = 'TestPassword123!';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'auth.bcryptRounds' ? 10 : undefined,
          },
        },
      ],
    }).compile();

    service = module.get(PasswordService);
  });

  it('hashPassword + comparePassword round-trip', async () => {
    const hash = await service.hashPassword(PASSWORD_SINTETICA);
    expect(hash).not.toBe(PASSWORD_SINTETICA);
    expect(await service.comparePassword(PASSWORD_SINTETICA, hash)).toBe(true);
    expect(await service.comparePassword('wrong', hash)).toBe(false);
  });

  it('hash fallido no expone detalle bcrypt al caller Nest', async () => {
    const spy = jest
      .spyOn(passwordUtil, 'hashPassword')
      .mockRejectedValueOnce(new Error('bcrypt salt boom detail'));

    let caught: unknown;
    try {
      await service.hashPassword(PASSWORD_SINTETICA);
    } catch (error) {
      caught = error;
    } finally {
      spy.mockRestore();
    }

    expect(caught).toBeInstanceOf(InternalServerErrorException);
    expect(String(caught)).not.toMatch(/bcrypt|salt/i);
    expect((caught as InternalServerErrorException).message).toBe(
      'No se pudo procesar la contraseña.',
    );
  });

  it('no mantiene estado mutable global entre llamadas', async () => {
    const [h1, h2] = await Promise.all([
      service.hashPassword(PASSWORD_SINTETICA),
      service.hashPassword('OtraSintetica456!'),
    ]);
    expect(await service.comparePassword(PASSWORD_SINTETICA, h1)).toBe(true);
    expect(await service.comparePassword('OtraSintetica456!', h2)).toBe(true);
    expect(await service.comparePassword(PASSWORD_SINTETICA, h2)).toBe(false);
  });
});
