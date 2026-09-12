import { BadRequestException } from '@nestjs/common';
import { Material } from '../entities/material.entity';

/**
 * Representa el resultado detallado de la validación de existencias disponibles para una salida.
 */
export interface ResultadoValidacionStock {
  /**
   * Indica si la operación es admisible con el stock disponible.
   */
  esValido: boolean;

  /**
   * Identificador del material consultado.
   */
  materialId: number;

  /**
   * Nombre del material consultado.
   */
  materialNombre: string;

  /**
   * Existencias físicas disponibles en bodega previo a la salida.
   */
  stockActual: number;

  /**
   * Cantidad solicitada para retiro.
   */
  cantidadSolicitada: number;

  /**
   * Existencias proyectadas que quedarían en bodega tras autorizar la salida (nunca menor a 0).
   */
  stockFinal: number;

  /**
   * Nivel de stock mínimo configurado para el material.
   */
  stockMinimo: number;

  /**
   * Bandera para el Backlog 4.8 (Alertas de stock mínimo):
   * `true` si el stock final proyectado queda igual o por debajo del umbral de stock mínimo.
   */
  alcanzaStockMinimo: boolean;

  /**
   * Indica si la salida agotará completamente las existencias del material en bodega (`stockFinal === 0`).
   */
  esAgotamientoTotal: boolean;

  /**
   * Mensaje descriptivo del resultado de la verificación.
   */
  mensaje: string;
}

export type MaterialParaValidacion = Pick<
  Material,
  'id' | 'nombre' | 'activo' | 'stockActual' | 'stockMinimo'
>;

/**
 * Valida de forma funcional y no intrusiva si un material cuenta con existencias suficientes
 * para autorizar una salida física.
 *
 * Reglas de negocio:
 * 1. La cantidad debe ser un entero estrictamente positivo (> 0).
 * 2. El material debe encontrarse activo.
 * 3. La cantidad solicitada no puede superar las existencias disponibles (`stockActual`).
 * 4. El stock resultante nunca puede ser negativo (`stockFinal >= 0`).
 * 5. Se admite que la salida deje las existencias exactamente en cero.
 * 6. Se calcula si el stock final alcanza o rompe el stock mínimo (preparación Backlog 4.8).
 */
export function validarStockDisponible(
  material: MaterialParaValidacion,
  cantidad: number,
): ResultadoValidacionStock {
  const stockMinimo = material.stockMinimo ?? 0;
  const stockActual = material.stockActual ?? 0;

  if (
    typeof cantidad !== 'number' ||
    !Number.isInteger(cantidad) ||
    cantidad <= 0
  ) {
    return {
      esValido: false,
      materialId: material.id,
      materialNombre: material.nombre,
      stockActual,
      cantidadSolicitada: cantidad,
      stockFinal: stockActual,
      stockMinimo,
      alcanzaStockMinimo: stockActual <= stockMinimo,
      esAgotamientoTotal: stockActual === 0,
      mensaje: 'La cantidad a retirar debe ser un número entero mayor a cero',
    };
  }

  if (!material.activo) {
    return {
      esValido: false,
      materialId: material.id,
      materialNombre: material.nombre,
      stockActual,
      cantidadSolicitada: cantidad,
      stockFinal: stockActual,
      stockMinimo,
      alcanzaStockMinimo: stockActual <= stockMinimo,
      esAgotamientoTotal: stockActual === 0,
      mensaje: `No se pueden registrar salidas para el material "${material.nombre}" porque se encuentra inactivo`,
    };
  }

  if (cantidad > stockActual) {
    return {
      esValido: false,
      materialId: material.id,
      materialNombre: material.nombre,
      stockActual,
      cantidadSolicitada: cantidad,
      stockFinal: stockActual,
      stockMinimo,
      alcanzaStockMinimo: stockActual <= stockMinimo,
      esAgotamientoTotal: stockActual === 0,
      mensaje: `Stock insuficiente para realizar la salida. Existencias disponibles: ${stockActual}, cantidad solicitada: ${cantidad}`,
    };
  }

  const stockFinal = stockActual - cantidad;
  const alcanzaStockMinimo = stockFinal <= stockMinimo;
  const esAgotamientoTotal = stockFinal === 0;

  let mensaje = `Salida autorizada. Stock actual: ${stockActual}, cantidad a retirar: ${cantidad}, stock resultante: ${stockFinal}.`;
  if (esAgotamientoTotal) {
    mensaje +=
      ' Atención: la salida agotará totalmente las existencias de este material.';
  } else if (alcanzaStockMinimo) {
    mensaje += ` Atención: el stock resultante (${stockFinal}) alcanzará o estará por debajo del stock mínimo (${stockMinimo}).`;
  }

  return {
    esValido: true,
    materialId: material.id,
    materialNombre: material.nombre,
    stockActual,
    cantidadSolicitada: cantidad,
    stockFinal,
    stockMinimo,
    alcanzaStockMinimo,
    esAgotamientoTotal,
    mensaje,
  };
}

/**
 * Aplica las aserciones obligatorias de negocio para la salida física de un material.
 * Lanza `BadRequestException` si la cantidad no es válida, el material está inactivo o el stock es insuficiente.
 * Retorna el resultado de la validación cuando es exitosa.
 */
export function assertStockDisponible(
  material: MaterialParaValidacion,
  cantidad: number,
): ResultadoValidacionStock {
  const resultado = validarStockDisponible(material, cantidad);
  if (!resultado.esValido) {
    throw new BadRequestException(resultado.mensaje);
  }
  return resultado;
}
