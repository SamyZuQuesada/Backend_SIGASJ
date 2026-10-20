import { FormularioOficial } from './formulario-oficial.entity';
import { TipoSolicitud } from './tipo-solicitud.entity';

describe('Entidad FormularioOficial', () => {
  it('1. Debe instanciarse correctamente con todos sus metadatos', () => {
    const form = new FormularioOficial();
    const ahora = new Date();

    form.id = 1;
    form.tipoSolicitudId = 1;
    form.nombreArchivoOriginal = 'Formulario_Arreglo_Pago.pdf';
    form.nombreArchivoInterno = 'uuid-1234.pdf';
    form.mimeType = 'application/pdf';
    form.tamano = 102400;
    form.ubicacionArchivo = 'formularios-oficiales/uuid-1234.pdf';
    form.fechaCarga = ahora;

    expect(form.id).toBe(1);
    expect(form.tipoSolicitudId).toBe(1);
    expect(form.nombreArchivoOriginal).toBe('Formulario_Arreglo_Pago.pdf');
    expect(form.nombreArchivoInterno).toBe('uuid-1234.pdf');
    expect(form.mimeType).toBe('application/pdf');
    expect(form.tamano).toBe(102400);
    expect(form.ubicacionArchivo).toBe('formularios-oficiales/uuid-1234.pdf');
    expect(form.fechaCarga).toBe(ahora);
  });

  it('2. Debe vincularse en relación 1:1 con TipoSolicitud', () => {
    const tipo = new TipoSolicitud();
    tipo.id = 1;
    tipo.slug = 'arreglo-pago';

    const form = new FormularioOficial();
    form.tipoSolicitudId = 1;
    form.tipoSolicitud = tipo;
    tipo.formularioOficial = form;

    expect(form.tipoSolicitud).toBe(tipo);
    expect(tipo.formularioOficial).toBe(form);
    expect(tipo.formularioOficial.tipoSolicitudId).toBe(1);
  });
});
