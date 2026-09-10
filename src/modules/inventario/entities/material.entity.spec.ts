import { BadRequestException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { Material } from './material.entity';

describe('Material Entity (Inventario ASADA)', () => {
  describe('Instanciación y Atributos Básicos', () => {
    it('debe existir la clase Material', () => {
      expect(Material).toBeDefined();
    });

    it('debe permitir instanciar y asignar todos los atributos requeridos', () => {
      const material = new Material();
      const fechaCreacion = new Date('2026-09-09T10:00:00Z');
      const fechaActualizacion = new Date('2026-09-09T12:00:00Z');

      material.id = 1;
      material.nombre = 'Tubo PVC 1/2 pulgada SDR 13.5';
      material.descripcion = 'Tubo para conducción de agua potable a presión';
      material.unidadMedida = 'Tubo';
      material.ubicacion = 'Bodega Principal - Estante B2';
      material.stockMinimo = 15;
      material.stockActual = 40;
      material.activo = true;
      material.createdAt = fechaCreacion;
      material.updatedAt = fechaActualizacion;

      expect(material.id).toBe(1);
      expect(material.nombre).toBe('Tubo PVC 1/2 pulgada SDR 13.5');
      expect(material.descripcion).toBe(
        'Tubo para conducción de agua potable a presión',
      );
      expect(material.unidadMedida).toBe('Tubo');
      expect(material.ubicacion).toBe('Bodega Principal - Estante B2');
      expect(material.stockMinimo).toBe(15);
      expect(material.stockActual).toBe(40);
      expect(material.activo).toBe(true);
      expect(material.createdAt).toEqual(fechaCreacion);
      expect(material.updatedAt).toEqual(fechaActualizacion);
    });

    it('debe permitir almacenar descripcion y ubicacion nulas u opcionales', () => {
      const material = new Material();
      material.nombre = 'Cinta Teflón';
      material.descripcion = null;
      material.unidadMedida = 'Rollo';
      material.ubicacion = null;
      material.stockMinimo = 5;

      expect(material.descripcion).toBeNull();
      expect(material.ubicacion).toBeNull();
    });

    it('debe permitir identificar materiales activos e inactivos', () => {
      const materialActivo = new Material();
      materialActivo.activo = true;

      const materialInactivo = new Material();
      materialInactivo.activo = false;

      expect(materialActivo.activo).toBe(true);
      expect(materialInactivo.activo).toBe(false);
    });
  });

  describe('Validaciones de Integridad Básicas (@BeforeInsert / @BeforeUpdate)', () => {
    it('debe validar y hacer trim al nombre y unidad de medida válidos', () => {
      const material = new Material();
      material.nombre = '  Válvula de bola 1/2"  ';
      material.unidadMedida = '  Unidad  ';
      material.stockMinimo = 10;
      material.stockActual = 25;

      material.validar();

      expect(material.nombre).toBe('Válvula de bola 1/2"');
      expect(material.unidadMedida).toBe('Unidad');
    });

    it('debe lanzar BadRequestException si el nombre está vacío o solo contiene espacios', () => {
      const material = new Material();
      material.nombre = '   ';
      material.unidadMedida = 'Unidad';

      expect(() => material.validar()).toThrow(BadRequestException);
      expect(() => material.validar()).toThrow(
        'El nombre del material es obligatorio',
      );
    });

    it('debe lanzar BadRequestException si la unidad de medida está vacía o solo contiene espacios', () => {
      const material = new Material();
      material.nombre = 'Pegamento PVC';
      material.unidadMedida = '   ';

      expect(() => material.validar()).toThrow(BadRequestException);
      expect(() => material.validar()).toThrow(
        'La unidad de medida es obligatoria',
      );
    });

    it('debe lanzar BadRequestException si el stock mínimo es negativo', () => {
      const material = new Material();
      material.nombre = 'Codo 90 PVC 1/2"';
      material.unidadMedida = 'Unidad';
      material.stockMinimo = -1;

      expect(() => material.validar()).toThrow(BadRequestException);
      expect(() => material.validar()).toThrow(
        'El stock mínimo no puede ser un número negativo',
      );
    });

    it('debe lanzar BadRequestException si el stock actual es negativo', () => {
      const material = new Material();
      material.nombre = 'Codo 90 PVC 1/2"';
      material.unidadMedida = 'Unidad';
      material.stockMinimo = 5;
      material.stockActual = -5;

      expect(() => material.validar()).toThrow(BadRequestException);
      expect(() => material.validar()).toThrow(
        'El stock actual no puede ser un número negativo',
      );
    });
  });

  describe('Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();

    it('debe estar registrada como entidad con el nombre "Material"', () => {
      const table = storage.tables.find(
        (t) => t.target === Material || t.name === 'Material',
      );
      expect(table).toBeDefined();
      expect(table?.name).toBe('Material');
    });

    it('debe tener configurada la llave primaria autoincremental "id"', () => {
      const primaryCol = storage.columns.find(
        (c) => c.target === Material && c.propertyName === 'id',
      );
      expect(primaryCol).toBeDefined();
      const generated = storage.generations.find(
        (g) => g.target === Material && g.propertyName === 'id',
      );
      expect(generated).toBeDefined();
      expect(generated?.strategy).toBe('increment');
    });

    it('debe tener configuradas todas las columnas requeridas', () => {
      const columns = storage.columns
        .filter((c) => c.target === Material)
        .map((c) => c.propertyName);

      expect(columns).toContain('id');
      expect(columns).toContain('nombre');
      expect(columns).toContain('descripcion');
      expect(columns).toContain('unidadMedida');
      expect(columns).toContain('ubicacion');
      expect(columns).toContain('stockMinimo');
      expect(columns).toContain('stockActual');
      expect(columns).toContain('activo');
      expect(columns).toContain('createdAt');
      expect(columns).toContain('updatedAt');
    });

    it('debe registrar createdAt y updatedAt como columnas de fecha de TypeORM', () => {
      const createdCol = storage.columns.find(
        (c) => c.target === Material && c.propertyName === 'createdAt',
      );
      const updatedCol = storage.columns.find(
        (c) => c.target === Material && c.propertyName === 'updatedAt',
      );

      expect(createdCol?.mode).toBe('createDate');
      expect(updatedCol?.mode).toBe('updateDate');
    });
  });
});
