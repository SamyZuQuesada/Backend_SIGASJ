import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

async function validateLogin(payload: Record<string, unknown>) {
  const dto = plainToInstance(LoginDto, payload, {
    enableImplicitConversion: true,
    excludeExtraneousValues: false,
  });
  return { dto, errors: await validate(dto) };
}

describe('LoginDto — validación de entrada', () => {
  const validPayload = {
    email: 'usuario.test@example.com',
    password: 'Secret1!',
  };

  it('acepta payload sintético válido', async () => {
    const { errors, dto } = await validateLogin(validPayload);
    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('usuario.test@example.com');
    expect(dto.password).toBe('Secret1!');
  });

  it('hace trim del correo pero no altera password con espacios internos', async () => {
    const { errors, dto } = await validateLogin({
      email: '  usuario.test@example.com  ',
      password: 'Sec ret1!',
    });
    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('usuario.test@example.com');
    expect(dto.password).toBe('Sec ret1!');
  });

  describe('email (identificador)', () => {
    it('rechaza ausente', async () => {
      const { password } = validPayload;
      const { errors } = await validateLogin({ password });
      const err = errors.find((e) => e.property === 'email');
      expect(err?.constraints?.isNotEmpty).toBe(
        'El correo electrónico es obligatorio',
      );
    });

    it('rechaza vacío y solo espacios (tras trim)', async () => {
      for (const email of ['', '   ']) {
        const { errors } = await validateLogin({ ...validPayload, email });
        const err = errors.find((e) => e.property === 'email');
        expect(err).toBeDefined();
        expect(
          err?.constraints?.isNotEmpty ?? err?.constraints?.isEmail,
        ).toBeDefined();
      }
    });

    it('rechaza formato inválido', async () => {
      for (const email of ['usuario', 'usuario@', '@dominio.com']) {
        const { errors } = await validateLogin({ ...validPayload, email });
        const err = errors.find((e) => e.property === 'email');
        expect(err?.constraints?.isEmail).toBe(
          'El correo electrónico no es válido',
        );
      }
    });

    it('rechaza tipo incorrecto', async () => {
      const { errors } = await validateLogin({
        ...validPayload,
        email: 12345,
      });
      const err = errors.find((e) => e.property === 'email');
      expect(err?.constraints?.isString).toBe(
        'El correo electrónico debe ser un texto válido',
      );
    });
  });

  describe('password', () => {
    it('rechaza ausente', async () => {
      const { email } = validPayload;
      const { errors } = await validateLogin({ email });
      const err = errors.find((e) => e.property === 'password');
      expect(err?.constraints?.isNotEmpty).toBe('La contraseña es obligatoria');
    });

    it('rechaza vacía', async () => {
      const { errors } = await validateLogin({
        ...validPayload,
        password: '',
      });
      const err = errors.find((e) => e.property === 'password');
      expect(err?.constraints?.isNotEmpty).toBe('La contraseña es obligatoria');
    });

    it('rechaza solo espacios sin trim de la password', async () => {
      const { errors, dto } = await validateLogin({
        ...validPayload,
        password: '      ',
      });
      expect(dto.password).toBe('      ');
      const err = errors.find((e) => e.property === 'password');
      expect(err).toBeDefined();
      expect(
        err?.constraints?.matches ?? err?.constraints?.minLength,
      ).toBeDefined();
    });

    it('rechaza tipo incorrecto (number)', async () => {
      const { errors } = await validateLogin({
        ...validPayload,
        password: 123456,
      });
      const err = errors.find((e) => e.property === 'password');
      expect(err?.constraints?.isString).toBe(
        'La contraseña debe ser un texto válido',
      );
    });

    it('rechaza longitud menor a política existente (6)', async () => {
      const { errors } = await validateLogin({
        ...validPayload,
        password: 'Ab12!',
      });
      const err = errors.find((e) => e.property === 'password');
      expect(err?.constraints?.minLength).toBe(
        'La contraseña debe tener al menos 6 caracteres',
      );
    });
  });

  it('ambos ausentes reportan errores en email y password', async () => {
    const { errors } = await validateLogin({});
    expect(errors.find((e) => e.property === 'email')).toBeDefined();
    expect(errors.find((e) => e.property === 'password')).toBeDefined();
  });

  it('no declara campos rol/activo/passwordHash en el contrato', () => {
    expect(Object.keys(new LoginDto())).toEqual(
      expect.not.arrayContaining(['rol', 'activo', 'passwordHash']),
    );
    const keys = Object.getOwnPropertyNames(LoginDto.prototype).filter(
      (k) => k !== 'constructor',
    );
    expect(keys).not.toEqual(
      expect.arrayContaining(['rol', 'activo', 'passwordHash']),
    );
  });
});
