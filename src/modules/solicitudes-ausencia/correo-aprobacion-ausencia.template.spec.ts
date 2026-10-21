import {
  construirHtmlAprobacionAusencia,
  construirTextoAprobacionAusencia,
  formatearFechaCorreo,
} from './correo-aprobacion-ausencia.template';

describe('correo-aprobacion-ausencia.template', () => {
  const datos = {
    nombre: 'Fontanero Demo',
    tipoLabel: 'permiso',
    solicitudId: 4016,
    fechaInicio: '2026-10-20',
    fechaFin: '2026-10-21',
    motivo: 'cita',
    urlMisSolicitudes: 'http://localhost:5173/fontanero/mis-solicitudes/4016',
  };

  it('formatea fechas a DD/MM/YYYY', () => {
    expect(formatearFechaCorreo('2026-10-20')).toBe('20/10/2026');
  });

  it('texto incluye periodo legible y enlace', () => {
    const text = construirTextoAprobacionAusencia(datos);
    expect(text).toContain('Hola Fontanero Demo,');
    expect(text).toContain('20/10/2026 — 21/10/2026');
    expect(text).toContain(datos.urlMisSolicitudes);
  });

  it('html incluye marca, estado y CTA', () => {
    const html = construirHtmlAprobacionAusencia(datos);
    expect(html).toContain('SIGASJ');
    expect(html).toContain('Aprobada');
    expect(html).toContain('Ver mis solicitudes');
    expect(html).toContain(datos.urlMisSolicitudes);
    expect(html).toContain('20/10/2026');
    expect(html).not.toContain('<script');
  });

  it('escapa HTML en motivo', () => {
    const html = construirHtmlAprobacionAusencia({
      ...datos,
      motivo: '<img src=x onerror=alert(1)>',
    });
    expect(html).toContain('&lt;img src=x');
    expect(html).not.toContain('<img src=x');
  });
});
