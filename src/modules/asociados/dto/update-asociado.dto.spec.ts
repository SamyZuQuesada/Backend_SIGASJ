import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAsociadoDto } from './update-asociado.dto';

async function validateUpdate(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateAsociadoDto, payload, {
    enableImplicitConversion: true,
  });
  return validate(dto);
}

describe('UpdateAsociadoDto - Validaciones y Reglas de Negocio', () => {
  it('acepta actualizaciones parciales válidas', async () => {
    const payloads = [
      { nombre: 'Carlos Alberto' },
      { apellidos: 'Pérez Mora' },
      { cedula: '1-1234-0567' },
      { correo: 'carlos.alberto@example.com' },
      { correoElectronico: 'carlos.alberto@example.com' },
    ];

    for (const p of payloads) {
      const errors = await validateUpdate(p);
      expect(errors).toHaveLength(0);
    }
  });

  describe('Validación de Nombre en actualización', () => {
    it('rechaza si el nombre está vacío o sólo contiene espacios', async () => {
      const errors = await validateUpdate({ nombre: '   ' });
      const err = errors.find((e) => e.property === 'nombre');
      expect(err).toBeDefined();
      expect(err?.constraints?.isNotEmpty).toBe('El nombre es obligatorio');
    });

    it('rechaza si el nombre excede 100 caracteres', async () => {
      const errors = await validateUpdate({ nombre: 'A'.repeat(101) });
      const err = errors.find((e) => e.property === 'nombre');
      expect(err).toBeDefined();
      expect(err?.constraints?.maxLength).toBe(
        'El nombre no puede exceder 100 caracteres',
      );
    });
  });

  describe('Validación de Apellidos en actualización', () => {
    it('rechaza si los apellidos están vacíos o sólo contienen espacios', async () => {
      const errors = await validateUpdate({ apellidos: '   ' });
      const err = errors.find((e) => e.property === 'apellidos');
      expect(err).toBeDefined();
      expect(err?.constraints?.isNotEmpty).toBe(
        'Los apellidos son obligatorios',
      );
    });

    it('rechaza si los apellidos exceden 100 caracteres', async () => {
      const errors = await validateUpdate({ apellidos: 'B'.repeat(101) });
      const err = errors.find((e) => e.property === 'apellidos');
      expect(err).toBeDefined();
      expect(err?.constraints?.maxLength).toBe(
        'Los apellidos no pueden exceder 100 caracteres',
      );
    });
  });

  describe('Validación de Cédula en actualización', () => {
    it('rechaza si la cédula está vacía o sólo contiene espacios', async () => {
      const errors = await validateUpdate({ cedula: '   ' });
      const err = errors.find((e) => e.property === 'cedula');
      expect(err).toBeDefined();
      expect(err?.constraints?.isNotEmpty).toBe('La cédula es obligatoria');
    });

    it('rechaza si la cédula excede 30 caracteres', async () => {
      const errors = await validateUpdate({
        cedula: '1234567890123456789012345678901',
      });
      const err = errors.find((e) => e.property === 'cedula');
      expect(err).toBeDefined();
      expect(err?.constraints?.maxLength).toBe(
        'La cédula no puede exceder 30 caracteres',
      );
    });
  });

  describe('Validación de Correo en actualización', () => {
    it('rechaza si el correo alias "correo" está vacío o contiene sólo espacios', async () => {
      const errors = await validateUpdate({ correo: '   ' });
      const err = errors.find((e) => e.property === 'correo');
      expect(err).toBeDefined();
      expect(err?.constraints?.isNotEmpty).toBe(
        'El correo electrónico no puede estar vacío',
      );
    });

    it('rechaza si "correo" tiene un formato inválido', async () => {
      const errors = await validateUpdate({ correo: 'no-es-correo' });
      const err = errors.find((e) => e.property === 'correo');
      expect(err).toBeDefined();
      expect(err?.constraints?.isEmail).toBe(
        'El correo electrónico no tiene un formato válido',
      );
    });

    it('rechaza si "correo" excede 150 caracteres', async () => {
      const errors = await validateUpdate({
        correo: `${'a'.repeat(140)}@example.com`,
      });
      const err = errors.find((e) => e.property === 'correo');
      expect(err).toBeDefined();
      expect(err?.constraints?.maxLength).toBe(
        'El correo electrónico no puede exceder 150 caracteres',
      );
    });

    it('rechaza si "correoElectronico" está vacío o tiene formato inválido', async () => {
      const errorsVacio = await validateUpdate({ correoElectronico: '   ' });
      expect(
        errorsVacio.some((e) => e.property === 'correoElectronico'),
      ).toBe(true);

      const errorsInvalido = await validateUpdate({
        correoElectronico: 'invalido',
      });
      expect(
        errorsInvalido.some((e) => e.property === 'correoElectronico'),
      ).toBe(true);
    });
  });

  describe('Eliminación de espacios innecesarios', () => {
    it('aplica trim a los campos modificados y normaliza la cédula', () => {
      const dto = plainToInstance(
        UpdateAsociadoDto,
        {
          nombre: '  Carlos  ',
          apellidos: '  González  ',
          cedula: '  204560789  ',
          correo: '  Carlos@Example.COM  ',
        },
        { enableImplicitConversion: true },
      );

      expect(dto.nombre).toBe('Carlos');
      expect(dto.apellidos).toBe('González');
      expect(dto.cedula).toBe('2-0456-0789');
      expect(dto.correo).toBe('carlos@example.com');
    });
  });
});
