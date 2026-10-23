import { SolicitudAfiliacion } from './solicitud-afiliacion.entity';
import { Solicitud } from './solicitud.entity';

describe('Entidad SolicitudAfiliacion', () => {
  let detalle: SolicitudAfiliacion;

  beforeEach(() => {
    detalle = new SolicitudAfiliacion();
    detalle.solicitudId = 40;
    detalle.fechaSolicitud = '2026-10-23';
    detalle.nombre = 'María Elena Rodríguez Vargas';
    detalle.identificacion = '1-1234-0567';
    detalle.vecinoDe = 'San Juan, 200 m norte de la plaza de deportes';
    detalle.estadoCivil = 'Casado(a)';
    detalle.telefono = '8888-1234';
    detalle.correoElectronico = 'maria.rodriguez@ejemplo.com';
    detalle.numeroAbonado = '45892';
    detalle.numeroPlano = 'SJ-1234567-2020';
    detalle.folioReal = '123456-000';
    detalle.firmaSolicitante =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...';
    detalle.recomendacion1Nombre = 'Carlos Alberto Mora Chaves';
    detalle.recomendacion1Identificacion = '1-0987-6543';
    detalle.recomendacion1NumeroAbonado = '12045';
    detalle.recomendacion1Firma =
      'https://storage.asadasanjuan.cr/firmas/rec1.png';
    detalle.recomendacion2Nombre = 'Ana Lucía Vargas Quirós';
    detalle.recomendacion2Identificacion = '1-2345-6789';
    detalle.recomendacion2NumeroAbonado = '13088';
    detalle.recomendacion2Firma =
      'https://storage.asadasanjuan.cr/firmas/rec2.png';
  });

  it('1. Debe instanciarse con relación Solicitud 1:1', () => {
    const solicitud = new Solicitud();
    solicitud.id = 40;
    solicitud.codigoSeguimiento = 'SOL-2026-AFI001';

    detalle.solicitud = solicitud;
    solicitud.detalleAfiliacion = detalle;

    expect(detalle.solicitud).toBe(solicitud);
    expect(solicitud.detalleAfiliacion).toBe(detalle);
    expect(solicitud.detalleAfiliacion?.solicitudId).toBe(40);
  });

  it('2. Debe representar fecha del formulario (distinta de auditoría)', () => {
    expect(detalle.fechaSolicitud).toBe('2026-10-23');
  });

  it('3. Debe representar datos del solicitante', () => {
    expect(detalle.nombre).toBe('María Elena Rodríguez Vargas');
    expect(detalle.identificacion).toBe('1-1234-0567');
    expect(detalle.vecinoDe).toContain('San Juan');
    expect(detalle.estadoCivil).toBe('Casado(a)');
    expect(detalle.telefono).toBe('8888-1234');
    expect(detalle.correoElectronico).toBe('maria.rodriguez@ejemplo.com');
  });

  it('4. Debe conservar identificación y abonado como texto (ceros/guiones)', () => {
    detalle.identificacion = '01-0234-0567';
    detalle.numeroAbonado = '0045892';
    expect(detalle.identificacion).toBe('01-0234-0567');
    expect(detalle.numeroAbonado).toBe('0045892');
    expect(typeof detalle.numeroAbonado).toBe('string');
  });

  it('5. Debe representar plano, folio y firma del solicitante', () => {
    expect(detalle.numeroPlano).toBe('SJ-1234567-2020');
    expect(detalle.folioReal).toBe('123456-000');
    expect(detalle.firmaSolicitante).toContain('data:image/png');
    detalle.folioReal = null;
    detalle.firmaSolicitante = null;
    expect(detalle.folioReal).toBeNull();
    expect(detalle.firmaSolicitante).toBeNull();
  });

  it('6. Debe representar Recomendación 1 completa', () => {
    expect(detalle.recomendacion1Nombre).toBe('Carlos Alberto Mora Chaves');
    expect(detalle.recomendacion1Identificacion).toBe('1-0987-6543');
    expect(detalle.recomendacion1NumeroAbonado).toBe('12045');
    expect(detalle.recomendacion1Firma).toContain('rec1');
  });

  it('7. Debe representar Recomendación 2 completa sin sobrescribir la 1', () => {
    expect(detalle.recomendacion2Nombre).toBe('Ana Lucía Vargas Quirós');
    expect(detalle.recomendacion2Identificacion).toBe('1-2345-6789');
    expect(detalle.recomendacion2NumeroAbonado).toBe('13088');
    expect(detalle.recomendacion2Firma).toContain('rec2');
    expect(detalle.recomendacion1Nombre).toBe('Carlos Alberto Mora Chaves');
    expect(detalle.recomendacion1NumeroAbonado).not.toBe(
      detalle.recomendacion2NumeroAbonado,
    );
  });

  it('8. Debe permitir ambas recomendaciones simultáneamente', () => {
    expect(detalle.recomendacion1Nombre).toBeTruthy();
    expect(detalle.recomendacion2Nombre).toBeTruthy();
    expect(detalle.recomendacion1Identificacion).not.toBe(
      detalle.recomendacion2Identificacion,
    );
  });

  it('9. Junta Directiva no tiene columnas inventadas (ADMIN_ONLY BLOCKED)', () => {
    const keys = Object.keys(detalle);
    expect(keys.some((k) => /junta|sesion|acuerdo|aprobad/i.test(k))).toBe(
      false,
    );
  });
});
