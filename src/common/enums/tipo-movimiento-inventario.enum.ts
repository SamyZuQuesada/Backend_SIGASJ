/**
 * Tipos de movimientos autorizados en el inventario de bodega de la ASADA.
 * Permite reutilizar una única entidad tanto para ingresos como para egresos de existencias.
 */
export enum TipoMovimientoInventario {
  /**
   * Operación que incrementa el stock actual del material
   * (Compras, donaciones, devoluciones de campo, reposiciones).
   */
  ENTRADA = 'ENTRADA',

  /**
   * Operación que decrementa el stock actual del material
   * (Despacho a fontaneros, atención de averías, solicitudes de conexión, proyectos de mantenimiento).
   */
  SALIDA = 'SALIDA',
}
