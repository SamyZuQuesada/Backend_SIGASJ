import {
  construirHtmlReparacionExitosa,
  construirTextoReparacionExitosa,
} from './correo-reparacion-exitosa.template';

describe('correo-reparacion-exitosa.template', () => {
  const datos = {
    nombreReportante: 'María Rodríguez',
    codigoSeguimiento: 'AV-2026-0042',
    ubicacion: 'Frente a la escuela, 50 m sur',
    sectorComunidad: 'San Juan',
  };

  it('texto incluye código y saludo', () => {
    const text = construirTextoReparacionExitosa(datos);
    expect(text).toContain('Hola María Rodríguez,');
    expect(text).toContain('AV-2026-0042');
    expect(text).toContain('completada exitosamente');
    expect(text).toContain('San Juan');
  });

  it('html incluye marca, estado y código escapado', () => {
    const html = construirHtmlReparacionExitosa(datos);
    expect(html).toContain('SIGASJ');
    expect(html).toContain('Reparada');
    expect(html).toContain('AV-2026-0042');
    expect(html).toContain('Su avería fue solucionada');
    expect(html).not.toContain('<script');
  });

  it('escapa HTML en ubicación y nombre', () => {
    const html = construirHtmlReparacionExitosa({
      ...datos,
      nombreReportante: '<script>alert(1)</script>',
      ubicacion: '<img src=x onerror=alert(1)>',
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
  });
});
