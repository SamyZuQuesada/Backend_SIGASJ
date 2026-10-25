import { FormularioDescargable } from './formulario-descargable.entity';

describe('Entidad FormularioDescargable', () => {
  const buildBase = (): FormularioDescargable => {
    const form = new FormularioDescargable();
    form.id = 1;
    form.nombre = 'Solicitud de nueva conexión';
    form.descripcion = 'Use este formulario para solicitar una conexión nueva.';
    form.nombreArchivoOriginal = 'solicitud-conexion.pdf';
    form.nombreArchivoInterno = '550e8400-e29b-41d4-a716-446655440000.pdf';
    form.ubicacionArchivo =
      'formularios-descargables/550e8400-e29b-41d4-a716-446655440000.pdf';
    form.activo = false;
    form.fechaPublicacion = null;
    return form;
  };

  it('se instancia con nombre, descripción, archivo, activo y fechas', () => {
    const form = buildBase();
    const publicada = new Date('2026-10-25T12:00:00.000Z');
    form.activo = true;
    form.fechaPublicacion = publicada;
    form.createdAt = new Date('2026-10-20T08:00:00.000Z');
    form.updatedAt = new Date('2026-10-25T12:00:00.000Z');

    expect(form.id).toBe(1);
    expect(form.nombre).toBe('Solicitud de nueva conexión');
    expect(form.descripcion).toContain('conexión');
    expect(form.nombreArchivoOriginal).toBe('solicitud-conexion.pdf');
    expect(form.nombreArchivoInterno).toMatch(/\.pdf$/);
    expect(form.ubicacionArchivo).toMatch(/^formularios-descargables\//);
    expect(form.ubicacionArchivo).not.toMatch(/^[A-Za-z]:\\/);
    expect(form.activo).toBe(true);
    expect(form.fechaPublicacion).toEqual(publicada);
    expect(form.createdAt).toBeInstanceOf(Date);
    expect(form.updatedAt).toBeInstanceOf(Date);
  });

  it('permite activo=true y activo=false sin borrar el registro', () => {
    const form = buildBase();
    expect(form.activo).toBe(false);

    form.activo = true;
    expect(form.activo).toBe(true);

    form.activo = false;
    expect(form.activo).toBe(false);
  });

  it('permite descripción nula y fechaPublicacion nula (borrador)', () => {
    const form = buildBase();
    form.descripcion = null;
    form.fechaPublicacion = null;
    form.activo = false;

    expect(form.descripcion).toBeNull();
    expect(form.fechaPublicacion).toBeNull();
    expect(form.activo).toBe(false);
  });

  it('conserva Unicode en nombre y descripción', () => {
    const form = buildBase();
    form.nombre = 'Formulario de actualización de datos — áéíóúñ';
    form.descripcion = 'Información útil: áéíóú ÁÉÍÓÚ ñ Ñ.';

    expect(form.nombre).toContain('áéíóúñ');
    expect(form.descripcion).toContain('ñ Ñ');
  });

  it('acepta textos cercanos al maxlength de nombre y descripción', () => {
    const form = buildBase();
    form.nombre = 'N'.repeat(200);
    form.descripcion = 'D'.repeat(1000);

    expect(form.nombre).toHaveLength(200);
    expect(form.descripcion).toHaveLength(1000);
  });

  it('acepta ubicacionArchivo relativa larga dentro de 255', () => {
    const form = buildBase();
    const key = `formularios-descargables/${'a'.repeat(40)}-${'b'.repeat(40)}.pdf`;
    expect(key.length).toBeLessThanOrEqual(255);
    form.ubicacionArchivo = key;
    expect(form.ubicacionArchivo).toBe(key);
  });
});
