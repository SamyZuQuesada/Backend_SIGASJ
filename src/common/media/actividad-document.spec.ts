import { BadRequestException } from '@nestjs/common';
import {
  deleteActividadDocument,
  saveActividadDocument,
  validateActividadDocument,
  type ActividadDocumentFile,
} from './public-media';

const file = (
  originalname: string,
  mimetype: string,
  buffer: Buffer,
): ActividadDocumentFile => ({
  originalname,
  mimetype,
  buffer,
  size: buffer.length,
});

describe('documentos de actividades del fontanero', () => {
  const pdf = file(
    'comprobante.pdf',
    'application/pdf',
    Buffer.from('%PDF-1.7 contenido de prueba'),
  );

  it('acepta PDF cuya extensión, MIME y firma coinciden', () => {
    expect(() => validateActividadDocument(pdf)).not.toThrow();
  });

  it.each([
    ['archivo ausente', undefined],
    [
      'extensión incompatible',
      file('comprobante.exe', 'application/pdf', Buffer.from('%PDF-1.7')),
    ],
    [
      'MIME no permitido',
      file('comprobante.txt', 'text/plain', Buffer.from('texto')),
    ],
    [
      'firma binaria incompatible',
      file('comprobante.pdf', 'application/pdf', Buffer.from('no es pdf')),
    ],
  ])('rechaza %s', (_caso, invalidFile) => {
    expect(() => validateActividadDocument(invalidFile)).toThrow(
      BadRequestException,
    );
  });

  it('rechaza archivos mayores de 10 MB', () => {
    const oversized = file(
      'grande.pdf',
      'application/pdf',
      Buffer.alloc(10 * 1024 * 1024 + 1),
    );
    oversized.buffer.write('%PDF-');

    expect(() => validateActividadDocument(oversized)).toThrow(
      'El archivo no puede superar 10 MB.',
    );
  });

  it('genera una referencia segura y permite compensar el archivo guardado', () => {
    const actividadId = 987654321;
    const saved = saveActividadDocument(actividadId, pdf);

    expect(saved.filename).toMatch(/^\d+-[0-9a-f-]{36}\.pdf$/);
    expect(saved.filename).not.toContain(pdf.originalname);
    expect(() =>
      deleteActividadDocument(actividadId, saved.rutaReferenciaArchivo),
    ).not.toThrow();
  });
});
