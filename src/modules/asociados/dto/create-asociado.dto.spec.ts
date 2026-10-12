import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAsociadoDto } from './create-asociado.dto';

async function validateCreate(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateAsociadoDto, payload, {
    enableImplicitConversion: true,
  });
  return validate(dto);
}

describe('CreateAsociadoDto - Validaciones y Reglas de Negocio', () => {
  const validPayload = {
    nombre: 'Carlos',
    apellidos: 'Pérez Rodríguez',
    cedula: '1-1234-0567',
    correoElectronico: 'carlos.perez@example.cr',
  };

  it('acepta un payload con datos completos y válidos', async () => {
    const errors = await validateCreate(validPayload);
    expect(errors).toHaveLength(0);
  });

  describe('Validación de Nombre', () => {
    it('rechaza si falta el nombre', async () => {
      const { nombre, ...rest } = validPayload;
      const errors = await validateCreate(rest);
      const err = errors.find((e) => e.property === 'nombre');
      expect(err).toBeDefined();
      expect(err?.constraints).toMatchObject({
        isNotEmpty: 'El nombre es obligatorio',
      });
    });

    it('rechaza si el nombre está vacío o sólo contiene espacios', async () => {
      const errors = await validateCreate({ ...validPayload, nombre: '   ' });
      const err = errors.find((e) => e.property === 'nombre');
      expect(err).toBeDefined();
      expect(err?.constraints?.isNotEmpty).toBe('El nombre es obligatorio');
    });

    it('rechaza si el nombre no es una cadena de texto', async () => {
      const errors = await validateCreate({ ...validPayload, nombre: 12345 });
      const err = errors.find((e) => e.property === 'nombre');
      expect(err).toBeDefined();
      expect(err?.constraints?.isString).toBe(
        'El nombre debe ser una cadena de texto',
      );
    });

    it('rechaza si el nombre excede 100 caracteres', async () => {
      const largo = 'A'.repeat(101);
      const errors = await validateCreate({ ...validPayload, nombre: largo });
      const err = errors.find((e) => e.property === 'nombre');
      expect(err).toBeDefined();
      expect(err?.constraints?.maxLength).toBe(
        'El nombre no puede exceder 100 caracteres',
      );
    });
  });

  describe('Validación de Apellidos', () => {
    it('rechaza si faltan los apellidos', async () => {
      const { apellidos, ...rest } = validPayload;
      const errors = await validateCreate(rest);
      const err = errors.find((e) => e.property === 'apellidos');
      expect(err).toBeDefined();
      expect(err?.constraints?.isNotEmpty).toBe(
        'Los apellidos son obligatorios',
      );
    });

    it('rechaza si los apellidos están vacíos o sólo contienen espacios', async () => {
      const errors = await validateCreate({
        ...validPayload,
        apellidos: '   ',
      });
      const err = errors.find((e) => e.property === 'apellidos');
      expect(err).toBeDefined();
      expect(err?.constraints?.isNotEmpty).toBe(
        'Los apellidos son obligatorios',
      );
    });

    it('rechaza si los apellidos no son una cadena de texto', async () => {
      const errors = await validateCreate({
        ...validPayload,
        apellidos: true,
      });
      const err = errors.find((e) => e.property === 'apellidos');
      expect(err).toBeDefined();
      expect(err?.constraints?.isString).toBe(
        'Los apellidos deben ser una cadena de texto',
      );
    });

    it('rechaza si los apellidos exceden 100 caracteres', async () => {
      const largo = 'B'.repeat(101);
      const errors = await validateCreate({
        ...validPayload,
        apellidos: largo,
      });
      const err = errors.find((e) => e.property === 'apellidos');
      expect(err).toBeDefined();
      expect(err?.constraints?.maxLength).toBe(
        'Los apellidos no pueden exceder 100 caracteres',
      );
    });
  });

  describe('Validación de Cédula', () => {
    it('rechaza si falta la cédula', async () => {
      const { cedula, ...rest } = validPayload;
      const errors = await validateCreate(rest);
      const err = errors.find((e) => e.property === 'cedula');
      expect(err).toBeDefined();
      expect(err?.constraints?.isNotEmpty).toBe('La cédula es obligatoria');
    });

    it('rechaza si la cédula está vacía o sólo contiene espacios', async () => {
      const errors = await validateCreate({ ...validPayload, cedula: '   ' });
      const err = errors.find((e) => e.property === 'cedula');
      expect(err).toBeDefined();
      expect(err?.constraints?.isNotEmpty).toBe('La cédula es obligatoria');
    });

    it('rechaza si la cédula no es una cadena de texto', async () => {
      const errors = await validateCreate({
        ...validPayload,
        cedula: 101230456,
      });
      const err = errors.find((e) => e.property === 'cedula');
      expect(err).toBeDefined();
      expect(err?.constraints?.isString).toBe(
        'La cédula debe ser una cadena de texto',
      );
    });

    it('rechaza si la cédula excede 30 caracteres', async () => {
      const larga = '1234567890123456789012345678901';
      const errors = await validateCreate({ ...validPayload, cedula: larga });
      const err = errors.find((e) => e.property === 'cedula');
      expect(err).toBeDefined();
      expect(err?.constraints?.maxLength).toBe(
        'La cédula no puede exceder 30 caracteres',
      );
    });
  });

  describe('Validación de Correo Electrónico', () => {
    it('rechaza si falta el correo electrónico y no se provee correo', async () => {
      const { correoElectronico, ...rest } = validPayload;
      const errors = await validateCreate(rest);
      const err = errors.find((e) => e.property === 'correoElectronico');
      expect(err).toBeDefined();
      expect(err?.constraints?.isNotEmpty).toBe(
        'El correo electrónico es obligatorio',
      );
    });

    it('rechaza si el correo electrónico está vacío o sólo contiene espacios', async () => {
      const errors = await validateCreate({
        ...validPayload,
        correoElectronico: '   ',
      });
      const err = errors.find((e) => e.property === 'correoElectronico');
      expect(err).toBeDefined();
      expect(err?.constraints?.isNotEmpty).toBe(
        'El correo electrónico es obligatorio',
      );
    });

    it('rechaza si el correo no tiene un formato válido', async () => {
      const invalidos = [
        'invalido',
        'sin-arroba.com',
        'con espacios@test.com',
        '@sin-usuario.com',
      ];
      for (const inv of invalidos) {
        const errors = await validateCreate({
          ...validPayload,
          correoElectronico: inv,
        });
        const err = errors.find((e) => e.property === 'correoElectronico');
        expect(err).toBeDefined();
        expect(err?.constraints?.isEmail).toBe(
          'El correo electrónico no tiene un formato válido',
        );
      }
    });

    it('rechaza si el correo electrónico excede 150 caracteres', async () => {
      const largo = `${'a'.repeat(140)}@example.com`; // > 150 caracteres
      const errors = await validateCreate({
        ...validPayload,
        correoElectronico: largo,
      });
      const err = errors.find((e) => e.property === 'correoElectronico');
      expect(err).toBeDefined();
      expect(err?.constraints?.maxLength).toBe(
        'El correo electrónico no puede exceder 150 caracteres',
      );
    });

    it('acepta el alias "correo" cuando no se envía "correoElectronico"', async () => {
      const { correoElectronico, ...rest } = validPayload;
      const errors = await validateCreate({
        ...rest,
        correo: 'correo.alias@example.com',
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('Eliminación de Espacios Innecesarios y Normalización', () => {
    it('aplica trim a nombre, apellidos y correo, y normaliza la cédula', () => {
      const dto = plainToInstance(
        CreateAsociadoDto,
        {
          nombre: '  María Elena  ',
          apellidos: '  González Vargas  ',
          cedula: '  112340567  ',
          correoElectronico: '  Maria.Elena@Test.CR  ',
        },
        { enableImplicitConversion: true },
      );

      expect(dto.nombre).toBe('María Elena');
      expect(dto.apellidos).toBe('González Vargas');
      expect(dto.cedula).toBe('1-1234-0567');
      expect(dto.correoElectronico).toBe('maria.elena@test.cr');
    });
  });
});
