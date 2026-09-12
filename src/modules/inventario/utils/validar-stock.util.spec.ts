import { BadRequestException } from '@nestjs/common';
import {
  assertStockDisponible,
  validarStockDisponible,
  MaterialParaValidacion,
} from './validar-stock.util';

describe('validar-stock.util — Regla de negocio de existencias disponibles (4.5.2)', () => {
  const baseMaterial: MaterialParaValidacion = {
    id: 1,
    nombre: 'Tubo PVC 1/2 pulgada',
    activo: true,
    stockActual: 10,
    stockMinimo: 3,
  };

  describe('validarStockDisponible (función pura)', () => {
    it('permite una salida cuando el stock es suficiente y calcula el stock final correctamente', () => {
      const res = validarStockDisponible(baseMaterial, 4);

      expect(res.esValido).toBe(true);
      expect(res.stockActual).toBe(10);
      expect(res.cantidadSolicitada).toBe(4);
      expect(res.stockFinal).toBe(6);
      expect(res.esAgotamientoTotal).toBe(false);
      expect(res.alcanzaStockMinimo).toBe(false);
      expect(res.mensaje).toContain('Salida autorizada');
    });

    it('permite una salida que deje las existencias exactamente en cero (esAgotamientoTotal = true)', () => {
      const res = validarStockDisponible(baseMaterial, 10);

      expect(res.esValido).toBe(true);
      expect(res.stockActual).toBe(10);
      expect(res.cantidadSolicitada).toBe(10);
      expect(res.stockFinal).toBe(0);
      expect(res.esAgotamientoTotal).toBe(true);
      expect(res.alcanzaStockMinimo).toBe(true);
      expect(res.mensaje).toContain('agotará totalmente las existencias');
    });

    it('detecta alerta de stock mínimo cuando el stock resultante queda igual o por debajo de stockMinimo (Backlog 4.8)', () => {
      const res = validarStockDisponible(baseMaterial, 8); // 10 - 8 = 2 <= 3

      expect(res.esValido).toBe(true);
      expect(res.stockFinal).toBe(2);
      expect(res.alcanzaStockMinimo).toBe(true);
      expect(res.esAgotamientoTotal).toBe(false);
      expect(res.mensaje).toContain('estará por debajo del stock mínimo (3)');
    });

    it('rechaza cuando la cantidad solicitada supera el stock disponible y no altera existencias', () => {
      const res = validarStockDisponible(baseMaterial, 15);

      expect(res.esValido).toBe(false);
      expect(res.stockActual).toBe(10);
      expect(res.stockFinal).toBe(10);
      expect(res.mensaje).toContain(
        'Stock insuficiente para realizar la salida. Existencias disponibles: 10, cantidad solicitada: 15',
      );
    });

    it('rechaza cuando la cantidad es cero o negativa', () => {
      const resCero = validarStockDisponible(baseMaterial, 0);
      expect(resCero.esValido).toBe(false);
      expect(resCero.mensaje).toContain(
        'La cantidad a retirar debe ser un número entero mayor a cero',
      );

      const resNegativo = validarStockDisponible(baseMaterial, -3);
      expect(resNegativo.esValido).toBe(false);
      expect(resNegativo.mensaje).toContain(
        'La cantidad a retirar debe ser un número entero mayor a cero',
      );
    });

    it('rechaza cuando la cantidad no es un número entero', () => {
      const resDecimal = validarStockDisponible(baseMaterial, 2.5);
      expect(resDecimal.esValido).toBe(false);
      expect(resDecimal.mensaje).toContain(
        'La cantidad a retirar debe ser un número entero mayor a cero',
      );
    });

    it('rechaza cuando el material se encuentra inactivo', () => {
      const materialInactivo: MaterialParaValidacion = {
        ...baseMaterial,
        activo: false,
      };

      const res = validarStockDisponible(materialInactivo, 2);
      expect(res.esValido).toBe(false);
      expect(res.mensaje).toContain('porque se encuentra inactivo');
    });
  });

  describe('assertStockDisponible (función asertiva con excepciones)', () => {
    it('retorna el objeto de validación exitosa sin lanzar excepción', () => {
      const res = assertStockDisponible(baseMaterial, 5);
      expect(res.esValido).toBe(true);
      expect(res.stockFinal).toBe(5);
    });

    it('lanza BadRequestException ante cantidad superior al stock', () => {
      expect(() => assertStockDisponible(baseMaterial, 11)).toThrow(
        BadRequestException,
      );
      expect(() => assertStockDisponible(baseMaterial, 11)).toThrow(
        'Stock insuficiente para realizar la salida. Existencias disponibles: 10, cantidad solicitada: 11',
      );
    });

    it('lanza BadRequestException ante cantidad cero o negativa', () => {
      expect(() => assertStockDisponible(baseMaterial, 0)).toThrow(
        BadRequestException,
      );
      expect(() => assertStockDisponible(baseMaterial, -1)).toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException si el material está inactivo', () => {
      const materialInactivo = { ...baseMaterial, activo: false };
      expect(() => assertStockDisponible(materialInactivo, 1)).toThrow(
        BadRequestException,
      );
    });
  });
});
