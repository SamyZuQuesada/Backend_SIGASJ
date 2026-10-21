import { BadRequestException } from '@nestjs/common';
import {
  isPlazoArregloPagoValido,
  PlazoArregloPago,
  PLAZOS_ARREGLO_PAGO_PERMITIDOS,
} from '../../../common/enums/plazo-arreglo-pago.enum';
import { SolicitudArregloPago } from './solicitud-arreglo-pago.entity';
import { Solicitud } from './solicitud.entity';

describe('Entidad SolicitudArregloPago', () => {
  let detalle: SolicitudArregloPago;

  beforeEach(() => {
    detalle = new SolicitudArregloPago();
    detalle.solicitudId = 10;
    detalle.nombre = 'Juan Carlos Rodríguez Mora';
    detalle.cedula = '1-1234-0567';
    detalle.vecinoDe = 'San Juan de Desamparados, 200m norte de la plaza';
    detalle.telefono = '8888-1234';
    detalle.numeroCuentaServicio = 'CTA-00984';
    detalle.montoPrimaInicial = 30000;
    detalle.plazoSeleccionado = PlazoArregloPago.MESES_6;
    detalle.firma = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...';
  });

  it('1. Debe instanciarse correctamente con todos los campos oficiales requeridos', () => {
    expect(detalle.solicitudId).toBe(10);
    expect(detalle.nombre).toBe('Juan Carlos Rodríguez Mora');
    expect(detalle.cedula).toBe('1-1234-0567');
    expect(detalle.vecinoDe).toBe(
      'San Juan de Desamparados, 200m norte de la plaza',
    );
    expect(detalle.telefono).toBe('8888-1234');
    expect(detalle.numeroCuentaServicio).toBe('CTA-00984');
    expect(detalle.montoPrimaInicial).toBe(30000);
    expect(detalle.plazoSeleccionado).toBe(PlazoArregloPago.MESES_6);
    expect(detalle.firma).toContain('data:image/png;base64');
  });

  it('2. Debe vincularse en relación 1:1 con la entidad Solicitud', () => {
    const solicitud = new Solicitud();
    solicitud.id = 10;
    solicitud.codigoSeguimiento = 'SOL-2026-ARREG1';

    detalle.solicitud = solicitud;
    solicitud.detalleArregloPago = detalle;

    expect(detalle.solicitud).toBe(solicitud);
    expect(detalle.solicitud.id).toBe(10);
    expect(solicitud.detalleArregloPago).toBe(detalle);
    expect(solicitud.detalleArregloPago.numeroCuentaServicio).toBe('CTA-00984');
  });

  it('3. Debe admitir únicamente las opciones de plazo oficiales permitidas', () => {
    PLAZOS_ARREGLO_PAGO_PERMITIDOS.forEach((plazo) => {
      detalle.plazoSeleccionado = plazo;
      expect(() => detalle.validarCampos()).not.toThrow();
    });

    // Rechazar plazo no permitido
    detalle.plazoSeleccionado = '48 meses';
    expect(() => detalle.validarCampos()).toThrow(BadRequestException);

    detalle.plazoSeleccionado = 'indefinido';
    expect(() => detalle.validarCampos()).toThrow(BadRequestException);
  });

  it('4. Ningún plazo debe aparecer preseleccionado por defecto', () => {
    const nuevaInstancia = new SolicitudArregloPago();
    expect(nuevaInstancia.plazoSeleccionado).toBeUndefined();
  });

  it('5. Debe validar que la prima inicial no sea negativa', () => {
    detalle.montoPrimaInicial = 0;
    expect(() => detalle.validarCampos()).not.toThrow();

    detalle.montoPrimaInicial = 50000;
    expect(() => detalle.validarCampos()).not.toThrow();

    detalle.montoPrimaInicial = -100;
    expect(() => detalle.validarCampos()).toThrow(BadRequestException);
  });

  it('6. Debe admitir firma en formato data-URL, URL de archivo o nula', () => {
    detalle.firma = null;
    expect(() => detalle.validarCampos()).not.toThrow();

    detalle.firma = 'https://storage.asadasanjuan.cr/firmas/sol-10-firma.png';
    expect(() => detalle.validarCampos()).not.toThrow();
  });

  it('7. Función utilitaria isPlazoArregloPagoValido debe validar cadenas sin distinción estricta de mayúsculas', () => {
    expect(isPlazoArregloPagoValido('3 meses')).toBe(true);
    expect(isPlazoArregloPagoValido('6 MESES')).toBe(true);
    expect(isPlazoArregloPagoValido('12 meses')).toBe(true);
    expect(isPlazoArregloPagoValido(' 24 meses ')).toBe(true);
    expect(isPlazoArregloPagoValido('100 meses')).toBe(false);
    expect(isPlazoArregloPagoValido('')).toBe(false);
    expect(isPlazoArregloPagoValido(null as any)).toBe(false);
  });
});
