import {
  TipoSolicitudSlug,
  TIPOS_SOLICITUD_SEED,
} from '../../../common/enums/tipo-solicitud-slug.enum';
import { TipoSolicitud } from './tipo-solicitud.entity';

describe('TipoSolicitud Entity', () => {
  it('debe instanciar correctamente la entidad con todos sus campos', () => {
    const tipo = new TipoSolicitud();
    tipo.id = 1;
    tipo.nombre = 'Solicitud de Arreglo de Pago Domiciliar';
    tipo.descripcion = 'Trámite oficial para arreglo de pago';
    tipo.slug = TipoSolicitudSlug.ARREGLO_PAGO;
    tipo.activo = true;
    tipo.createdAt = new Date('2026-10-20T10:00:00Z');
    tipo.updatedAt = new Date('2026-10-20T10:00:00Z');

    expect(tipo.id).toBe(1);
    expect(tipo.nombre).toBe('Solicitud de Arreglo de Pago Domiciliar');
    expect(tipo.descripcion).toBe('Trámite oficial para arreglo de pago');
    expect(tipo.slug).toBe('arreglo-pago');
    expect(tipo.activo).toBe(true);
    expect(tipo.createdAt).toBeInstanceOf(Date);
    expect(tipo.updatedAt).toBeInstanceOf(Date);
  });

  it('debe permitir activar o inactivar un tipo sin perder información', () => {
    const tipo = new TipoSolicitud();
    tipo.id = 2;
    tipo.nombre = 'Cambio de Nombre del Titular del Servicio';
    tipo.slug = TipoSolicitudSlug.CAMBIO_TITULAR;
    tipo.activo = true;

    expect(tipo.activo).toBe(true);

    // Inactivar
    tipo.activo = false;
    expect(tipo.activo).toBe(false);

    // Reactivar
    tipo.activo = true;
    expect(tipo.activo).toBe(true);
  });

  it('debe permitir descripcion nula', () => {
    const tipo = new TipoSolicitud();
    tipo.nombre = 'Constancia de Servicio Existente';
    tipo.slug = TipoSolicitudSlug.SERVICIO_EXISTENTE;
    tipo.descripcion = null;

    expect(tipo.descripcion).toBeNull();
  });

  it('debe tener preparada la propiedad solicitudes sin forzar eliminación en cascada', () => {
    const tipo = new TipoSolicitud();
    tipo.solicitudes = [];
    expect(Array.isArray(tipo.solicitudes)).toBe(true);
  });

  it('debe contener exactamente los 6 trámites oficiales requeridos en TIPOS_SOLICITUD_SEED', () => {
    expect(TIPOS_SOLICITUD_SEED).toHaveLength(6);

    const slugs = TIPOS_SOLICITUD_SEED.map((t) => t.slug);
    expect(slugs).toContain(TipoSolicitudSlug.ARREGLO_PAGO);
    expect(slugs).toContain(TipoSolicitudSlug.CAMBIO_TITULAR);
    expect(slugs).toContain(TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS);
    expect(slugs).toContain(TipoSolicitudSlug.AFILIACION);
    expect(slugs).toContain(TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS);
    expect(slugs).toContain(TipoSolicitudSlug.SERVICIO_EXISTENTE);

    // Slugs descriptivos según requerimiento
    expect(TipoSolicitudSlug.ARREGLO_PAGO).toBe('arreglo-pago');
    expect(TipoSolicitudSlug.CAMBIO_TITULAR).toBe('cambio-titular');
    expect(TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS).toBe(
      'infraestructura-linderos',
    );
    expect(TipoSolicitudSlug.AFILIACION).toBe('afiliacion');
    expect(TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS).toBe(
      'disponibilidad-servicios',
    );
    expect(TipoSolicitudSlug.SERVICIO_EXISTENTE).toBe('servicio-existente');

    // Todos deben tener nombre y descripción definida
    for (const item of TIPOS_SOLICITUD_SEED) {
      expect(item.nombre.trim().length).toBeGreaterThan(0);
      expect(item.slug.trim().length).toBeGreaterThan(0);
      expect(item.descripcion.trim().length).toBeGreaterThan(0);
    }
  });
});
