import { BadRequestException } from '@nestjs/common';
import { CategoriaMaterial } from './categoria-material.entity';
import { Material } from './material.entity';

describe('CategoriaMaterial Entity (Inventario ASADA)', () => {
  describe('Instanciación y Atributos Básicos', () => {
    it('debe existir la clase CategoriaMaterial', () => {
      expect(CategoriaMaterial).toBeDefined();
    });

    it('debe permitir instanciar y asignar todos los atributos requeridos y opcionales', () => {
      const categoria = new CategoriaMaterial();
      const fechaCreacion = new Date('2026-09-09T10:00:00Z');
      const fechaActualizacion = new Date('2026-09-09T12:00:00Z');

      categoria.id = 1;
      categoria.nombre = 'Tuberías';
      categoria.descripcion =
        'Tuberías de PVC, polietileno y mangueras para conducción';
      categoria.activo = true;
      categoria.createdAt = fechaCreacion;
      categoria.updatedAt = fechaActualizacion;

      expect(categoria.id).toBe(1);
      expect(categoria.nombre).toBe('Tuberías');
      expect(categoria.descripcion).toBe(
        'Tuberías de PVC, polietileno y mangueras para conducción',
      );
      expect(categoria.activo).toBe(true);
      expect(categoria.createdAt).toEqual(fechaCreacion);
      expect(categoria.updatedAt).toEqual(fechaActualizacion);
    });

    it('debe permitir almacenar descripcion nula u opcional', () => {
      const categoria = new CategoriaMaterial();
      categoria.nombre = 'Válvulas';
      categoria.descripcion = null;

      expect(categoria.descripcion).toBeNull();
    });

    it('debe permitir identificar categorías activas e inactivas', () => {
      const catActiva = new CategoriaMaterial();
      catActiva.activo = true;

      const catInactiva = new CategoriaMaterial();
      catInactiva.activo = false;

      expect(catActiva.activo).toBe(true);
      expect(catInactiva.activo).toBe(false);
    });
  });

  describe('Validaciones y Hooks de Ciclo de Vida (@BeforeInsert / @BeforeUpdate)', () => {
    it('debe aplicar trim al nombre de la categoría', () => {
      const categoria = new CategoriaMaterial();
      categoria.nombre = '   Accesorios PVC   ';
      categoria.validar();

      expect(categoria.nombre).toBe('Accesorios PVC');
    });

    it('debe lanzar BadRequestException si el nombre es una cadena vacía', () => {
      const categoria = new CategoriaMaterial();
      categoria.nombre = '';

      expect(() => categoria.validar()).toThrow(BadRequestException);
      expect(() => categoria.validar()).toThrow(
        'El nombre de la categoría es obligatorio',
      );
    });

    it('debe lanzar BadRequestException si el nombre contiene solo espacios', () => {
      const categoria = new CategoriaMaterial();
      categoria.nombre = '     ';

      expect(() => categoria.validar()).toThrow(BadRequestException);
      expect(() => categoria.validar()).toThrow(
        'El nombre de la categoría es obligatorio',
      );
    });
  });

  describe('Relación con Material', () => {
    it('debe permitir asociar una colección de materiales a la categoría', () => {
      const categoria = new CategoriaMaterial();
      categoria.id = 2;
      categoria.nombre = 'Tuberías';

      const mat1 = new Material();
      mat1.id = 10;
      mat1.nombre = 'Tubo PVC 1/2"';

      const mat2 = new Material();
      mat2.id = 11;
      mat2.nombre = 'Tubo PVC 3/4"';

      categoria.materiales = [mat1, mat2];

      expect(categoria.materiales).toHaveLength(2);
      expect(categoria.materiales[0]?.nombre).toBe('Tubo PVC 1/2"');
      expect(categoria.materiales[1]?.nombre).toBe('Tubo PVC 3/4"');
    });
  });
});
