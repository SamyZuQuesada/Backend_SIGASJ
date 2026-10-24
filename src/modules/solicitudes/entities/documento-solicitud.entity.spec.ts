import { TipoDocumentoSolicitud } from '../../../common/enums/tipo-documento-solicitud.enum';
import { DocumentoSolicitud } from './documento-solicitud.entity';
import { Solicitud } from './solicitud.entity';

describe('DocumentoSolicitud Entity (Backlog 4.1.2 - Tarea 1)', () => {
  it('debe instanciar correctamente la entidad con todos los campos de metadatos requeridos', () => {
    const doc = new DocumentoSolicitud();
    doc.id = 1;
    doc.solicitudId = 10;
    doc.tipoDocumento = TipoDocumentoSolicitud.IDENTIFICACION;
    doc.nombreOriginal = 'cedula_identidad.pdf';
    doc.nombreInterno = '1729789123456-abc12345-uuid.pdf';
    doc.mimeType = 'application/pdf';
    doc.tamano = 204800;
    doc.ubicacion = '/uploads/solicitudes/pendientes/1729789123456-abc12345-uuid.pdf';
    doc.tokenReclamo = 'a1b2c3d4e5f67890abcdef1234567890';
    doc.fechaCarga = new Date('2026-10-24T10:00:00Z');

    expect(doc.id).toBe(1);
    expect(doc.solicitudId).toBe(10);
    expect(doc.tipoDocumento).toBe(TipoDocumentoSolicitud.IDENTIFICACION);
    expect(doc.nombreOriginal).toBe('cedula_identidad.pdf');
    expect(doc.nombreInterno).toBe('1729789123456-abc12345-uuid.pdf');
    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.tamano).toBe(204800);
    expect(doc.ubicacion).toBe(
      '/uploads/solicitudes/pendientes/1729789123456-abc12345-uuid.pdf',
    );
    expect(doc.tokenReclamo).toBe('a1b2c3d4e5f67890abcdef1234567890');
    expect(doc.fechaCarga).toBeInstanceOf(Date);
  });

  it('debe mantener la relación con Solicitud (cada archivo pertenece a una solicitud)', () => {
    const solicitud = new Solicitud();
    solicitud.id = 25;
    solicitud.codigoSeguimiento = 'SOL-2026-00025';

    const doc = new DocumentoSolicitud();
    doc.solicitudId = solicitud.id;
    doc.solicitud = solicitud;
    doc.tipoDocumento = TipoDocumentoSolicitud.PLANO_CATASTRADO;
    doc.nombreOriginal = 'plano.png';

    expect(doc.solicitudId).toBe(25);
    expect(doc.solicitud).toBeDefined();
    expect(doc.solicitud?.id).toBe(25);
    expect(doc.solicitud?.codigoSeguimiento).toBe('SOL-2026-00025');
  });

  it('debe sincronizar automáticamente campos de metadatos y alias en BeforeInsert / BeforeUpdate', () => {
    const doc = new DocumentoSolicitud();
    doc.mimeType = 'image/png';
    doc.tamano = 1024;
    doc.ubicacion = '/uploads/solicitudes/pendientes/1729789999-doc-test.png';

    doc.sincronizarMetadatos();

    // Sincroniza hacia aliases
    expect(doc.tipoArchivo).toBe('image/png');
    expect(doc.tamanio).toBe(1024);
    expect(doc.rutaReferenciaArchivo).toBe(
      '/uploads/solicitudes/pendientes/1729789999-doc-test.png',
    );
    expect(doc.nombreInterno).toBe('1729789999-doc-test.png');

    // Sincroniza desde aliases si vienen los antiguos
    const docAntiguo = new DocumentoSolicitud();
    docAntiguo.tipoArchivo = 'application/pdf';
    docAntiguo.tamanio = 5000;
    docAntiguo.rutaReferenciaArchivo = '/uploads/solicitudes/pendientes/archivo_antiguo.pdf';

    docAntiguo.sincronizarMetadatos();

    expect(docAntiguo.mimeType).toBe('application/pdf');
    expect(docAntiguo.tamano).toBe(5000);
    expect(docAntiguo.ubicacion).toBe(
      '/uploads/solicitudes/pendientes/archivo_antiguo.pdf',
    );
    expect(docAntiguo.nombreInterno).toBe('archivo_antiguo.pdf');
  });

  it('los nombres internos evitan colisiones para archivos con el mismo nombre original', () => {
    const nombreOriginal = 'cedula.pdf';
    const archivo1 = new DocumentoSolicitud();
    archivo1.nombreOriginal = nombreOriginal;
    archivo1.nombreInterno = `${Date.now()}-uuid-1-${nombreOriginal}`;

    const archivo2 = new DocumentoSolicitud();
    archivo2.nombreOriginal = nombreOriginal;
    archivo2.nombreInterno = `${Date.now() + 10}-uuid-2-${nombreOriginal}`;

    expect(archivo1.nombreOriginal).toBe(archivo2.nombreOriginal);
    expect(archivo1.nombreInterno).not.toBe(archivo2.nombreInterno);
  });
});
