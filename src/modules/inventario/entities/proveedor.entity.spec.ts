import { BadRequestException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { Proveedor } from './proveedor.entity';
import { Material } from './material.entity';

describe('Proveedor Entity (Inventario ASADA)', () => {
  describe('Instanciación y Atributos Básicos', () => {
    it('debe existir la clase Proveedor', () => {
      expect(Proveedor).toBeDefined();
    });

    it('debe permitir instanciar y asignar todos los atributos requeridos y opcionales', () => {
      const proveedor = new Proveedor();
      const fechaCreacion = new Date('2026-09-10T10:00:00Z');
      const fechaActualizacion = new Date('2026-09-10T12:00:00Z');

      proveedor.id = 1;
      proveedor.nombre = 'Ferretería El Lagar';
      proveedor.razonSocial = 'El Lagar Sociedad Anónima';
      proveedor.identificacion = '3-101-123456';
      proveedor.telefono = '2680-1122';
      proveedor.correo = 'ventas@ellagar.cr';
      proveedor.direccion = 'Nicoya, Guanacaste, 200m este del parque central';
      proveedor.personaContacto = 'Carlos Méndez (Asesor Comercial)';
      proveedor.activo = true;
      proveedor.createdAt = fechaCreacion;
      proveedor.updatedAt = fechaActualizacion;

      expect(proveedor.id).toBe(1);
      expect(proveedor.nombre).toBe('Ferretería El Lagar');
      expect(proveedor.razonSocial).toBe('El Lagar Sociedad Anónima');
      expect(proveedor.identificacion).toBe('3-101-123456');
      expect(proveedor.telefono).toBe('2680-1122');
      expect(proveedor.correo).toBe('ventas@ellagar.cr');
      expect(proveedor.direccion).toBe(
        'Nicoya, Guanacaste, 200m este del parque central',
      );
      expect(proveedor.personaContacto).toBe(
        'Carlos Méndez (Asesor Comercial)',
      );
      expect(proveedor.activo).toBe(true);
      expect(proveedor.createdAt).toEqual(fechaCreacion);
      expect(proveedor.updatedAt).toEqual(fechaActualizacion);
    });

    it('debe permitir almacenar campos opcionales nulos', () => {
      const proveedor = new Proveedor();
      proveedor.nombre = 'Distribuidora H2O';
      proveedor.razonSocial = null;
      proveedor.identificacion = null;
      proveedor.telefono = null;
      proveedor.correo = null;
      proveedor.direccion = null;
      proveedor.personaContacto = null;

      expect(proveedor.razonSocial).toBeNull();
      expect(proveedor.identificacion).toBeNull();
      expect(proveedor.telefono).toBeNull();
      expect(proveedor.correo).toBeNull();
      expect(proveedor.direccion).toBeNull();
      expect(proveedor.personaContacto).toBeNull();
    });

    it('debe permitir identificar proveedores activos e inactivos para preservar el historial', () => {
      const provActivo = new Proveedor();
      provActivo.activo = true;

      const provInactivo = new Proveedor();
      provInactivo.activo = false;

      expect(provActivo.activo).toBe(true);
      expect(provInactivo.activo).toBe(false);
    });
  });

  describe('Validaciones y Hooks de Ciclo de Vida (@BeforeInsert / @BeforeUpdate)', () => {
    it('debe aplicar trim al nombre y campos de texto válidos', () => {
      const proveedor = new Proveedor();
      proveedor.nombre = '   Ferretería San Juan   ';
      proveedor.razonSocial = '   San Juan S.A.   ';
      proveedor.identificacion = '   3-101-654321   ';
      proveedor.telefono = '   8888-9999   ';
      proveedor.personaContacto = '   Juan Pérez   ';
      proveedor.direccion = '   Santa Cruz centro   ';
      proveedor.correo = '  VENTAS@SANJUAN.CR  ';

      proveedor.validar();

      expect(proveedor.nombre).toBe('Ferretería San Juan');
      expect(proveedor.razonSocial).toBe('San Juan S.A.');
      expect(proveedor.identificacion).toBe('3-101-654321');
      expect(proveedor.telefono).toBe('8888-9999');
      expect(proveedor.personaContacto).toBe('Juan Pérez');
      expect(proveedor.direccion).toBe('Santa Cruz centro');
      expect(proveedor.correo).toBe('ventas@sanjuan.cr');
    });

    it('debe lanzar BadRequestException si el nombre o razón social está vacío', () => {
      const proveedor = new Proveedor();
      proveedor.nombre = '';

      expect(() => proveedor.validar()).toThrow(BadRequestException);
      expect(() => proveedor.validar()).toThrow(
        'El nombre o razón social del proveedor es obligatorio',
      );
    });

    it('debe lanzar BadRequestException si el nombre contiene solo espacios', () => {
      const proveedor = new Proveedor();
      proveedor.nombre = '     ';

      expect(() => proveedor.validar()).toThrow(BadRequestException);
      expect(() => proveedor.validar()).toThrow(
        'El nombre o razón social del proveedor es obligatorio',
      );
    });

    it('debe lanzar BadRequestException si el correo electrónico tiene un formato inválido', () => {
      const proveedor = new Proveedor();
      proveedor.nombre = 'Proveedor Válido';
      proveedor.correo = 'correo-no-valido';

      expect(() => proveedor.validar()).toThrow(BadRequestException);
      expect(() => proveedor.validar()).toThrow(
        'El formato del correo electrónico es inválido',
      );
    });

    it('debe aceptar correo electrónico vacío o de solo espacios convirtiéndolo a null', () => {
      const proveedor = new Proveedor();
      proveedor.nombre = 'Proveedor Válido';
      proveedor.correo = '    ';

      proveedor.validar();

      expect(proveedor.correo).toBeNull();
    });
  });

  describe('Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();

    it('debe estar registrada como entidad con el nombre "Proveedor"', () => {
      const table = storage.tables.find(
        (t) => t.target === Proveedor || t.name === 'Proveedor',
      );
      expect(table).toBeDefined();
      expect(table?.name).toBe('Proveedor');
    });

    it('debe tener configurada la llave primaria autoincremental "id"', () => {
      const primaryCol = storage.columns.find(
        (c) => c.target === Proveedor && c.propertyName === 'id',
      );
      expect(primaryCol).toBeDefined();
      const generated = storage.generations.find(
        (g) => g.target === Proveedor && g.propertyName === 'id',
      );
      expect(generated).toBeDefined();
      expect(generated?.strategy).toBe('increment');
    });

    it('debe tener configuradas todas las columnas de la entidad', () => {
      const columns = storage.columns
        .filter((c) => c.target === Proveedor)
        .map((c) => c.propertyName);

      expect(columns).toContain('id');
      expect(columns).toContain('nombre');
      expect(columns).toContain('razonSocial');
      expect(columns).toContain('identificacion');
      expect(columns).toContain('telefono');
      expect(columns).toContain('correo');
      expect(columns).toContain('direccion');
      expect(columns).toContain('personaContacto');
      expect(columns).toContain('activo');
      expect(columns).toContain('createdAt');
      expect(columns).toContain('updatedAt');
    });

    it('debe registrar createdAt y updatedAt como columnas automáticas de fecha', () => {
      const createdCol = storage.columns.find(
        (c) => c.target === Proveedor && c.propertyName === 'createdAt',
      );
      const updatedCol = storage.columns.find(
        (c) => c.target === Proveedor && c.propertyName === 'updatedAt',
      );

      expect(createdCol?.mode).toBe('createDate');
      expect(updatedCol?.mode).toBe('updateDate');
    });
  });

  describe('Relación con Material e Inventario', () => {
    it('debe permitir asociar una colección de materiales al proveedor', () => {
      const proveedor = new Proveedor();
      proveedor.id = 5;
      proveedor.nombre = 'Tubos y Conexiones CR';

      const mat1 = new Material();
      mat1.id = 101;
      mat1.nombre = 'Tubo PVC 1/2"';
      mat1.idProveedor = 5;
      mat1.proveedor = proveedor;

      const mat2 = new Material();
      mat2.id = 102;
      mat2.nombre = 'Válvula de bola 1/2"';
      mat2.idProveedor = 5;
      mat2.proveedor = proveedor;

      proveedor.materiales = [mat1, mat2];

      expect(proveedor.materiales).toHaveLength(2);
      expect(proveedor.materiales[0]?.nombre).toBe('Tubo PVC 1/2"');
      expect(proveedor.materiales[0]?.proveedor).toBe(proveedor);
      expect(proveedor.materiales[1]?.idProveedor).toBe(5);
    });
  });
});
