import { BadRequestException, NotFoundException } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import {
  deleteSolicitudDocumentFile,
  linkSolicitudDocumentFile,
  MAX_SOLICITUD_DOCUMENT_BYTES,
  saveSolicitudDocumentPending,
  validateSolicitudDocument,
  type SolicitudDocumentFile,
} from './public-media';

const makeFile = (
  originalname: string,
  mimetype: string,
  buffer: Buffer,
): SolicitudDocumentFile => ({
  originalname,
  mimetype,
  buffer,
  size: buffer.length,
});

describe('Recepción Segura de Documentos de Solicitud (Tarea 2 - Backlog 4.10.1)', () => {
  // Buffers con firmas binarias legítimas (magic bytes)
  const validPdfBuffer = Buffer.from('%PDF-1.7 Contenido de prueba oficial');
  const validPngBuffer = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  ]);
  const validJpgBuffer = Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70]);

  describe('1. Formatos permitidos y validación exitosa', () => {
    it('acepta archivos PDF válidos', () => {
      const pdf = makeFile('cedula.pdf', 'application/pdf', validPdfBuffer);
      expect(() => validateSolicitudDocument(pdf)).not.toThrow();
    });

    it('acepta imágenes PNG válidas', () => {
      const png = makeFile('plano.png', 'image/png', validPngBuffer);
      expect(() => validateSolicitudDocument(png)).not.toThrow();
    });

    it('acepta imágenes JPG válidas', () => {
      const jpg = makeFile('foto.jpg', 'image/jpeg', validJpgBuffer);
      expect(() => validateSolicitudDocument(jpg)).not.toThrow();
    });

    it('acepta imágenes con extensión JPEG válidas', () => {
      const jpeg = makeFile('identificacion.jpeg', 'image/jpeg', validJpgBuffer);
      expect(() => validateSolicitudDocument(jpeg)).not.toThrow();
    });
  });

  describe('2. Control de tamaño y límites', () => {
    it('rechaza archivos ausentes o vacíos (0 bytes)', () => {
      expect(() => validateSolicitudDocument(undefined)).toThrow(
        BadRequestException,
      );
      expect(() =>
        validateSolicitudDocument(
          makeFile('vacio.pdf', 'application/pdf', Buffer.alloc(0)),
        ),
      ).toThrow('Debe adjuntar un archivo.');
    });

    it('rechaza archivos que superen los 10 MB (MAX_SOLICITUD_DOCUMENT_BYTES)', () => {
      const oversizedBuffer = Buffer.alloc(MAX_SOLICITUD_DOCUMENT_BYTES + 1);
      oversizedBuffer.write('%PDF-');
      const oversized = makeFile(
        'grande.pdf',
        'application/pdf',
        oversizedBuffer,
      );

      expect(() => validateSolicitudDocument(oversized)).toThrow(
        'El archivo no puede superar 10 MB.',
      );
    });

    it('rechaza cuando el tamaño declarado no coincide con el buffer', () => {
      const corrupt = makeFile('corrupto.pdf', 'application/pdf', validPdfBuffer);
      corrupt.size = validPdfBuffer.length + 500;

      expect(() => validateSolicitudDocument(corrupt)).toThrow(
        'El tamaño declarado del archivo no coincide con su contenido.',
      );
    });
  });

  describe('3. Detección y rechazo de ejecutables y scripts', () => {
    it.each([
      ['ejecutable Windows (.exe)', 'malware.exe', 'application/octet-stream'],
      ['script Bash (.sh)', 'script.sh', 'application/x-sh'],
      ['script Batch (.bat)', 'install.bat', 'application/x-bat'],
      ['script PowerShell (.ps1)', 'exploit.ps1', 'text/plain'],
      ['instalador MSI (.msi)', 'setup.msi', 'application/x-msi'],
      ['código JavaScript (.js)', 'payload.js', 'application/javascript'],
      ['biblioteca DLL (.dll)', 'library.dll', 'application/x-msdownload'],
    ])('rechaza extensión peligrosa: %s', (_nombre, filename, mime) => {
      const file = makeFile(filename, mime, Buffer.from('contenido'));
      expect(() => validateSolicitudDocument(file)).toThrow(BadRequestException);
    });

    it('rechaza ejecutables con doble extensión maliciosa (ej: archivo.exe.pdf)', () => {
      const doubleExt = makeFile(
        'documento.exe.pdf',
        'application/pdf',
        validPdfBuffer,
      );
      expect(() => validateSolicitudDocument(doubleExt)).toThrow(
        'No se permiten archivos ejecutables o con extensiones potencialmente peligrosas.',
      );
    });

    it('rechaza scripts con doble extensión maliciosa (ej: foto.sh.jpg)', () => {
      const doubleExt = makeFile(
        'foto.sh.jpg',
        'image/jpeg',
        validJpgBuffer,
      );
      expect(() => validateSolicitudDocument(doubleExt)).toThrow(
        'No se permiten archivos ejecutables o con extensiones potencialmente peligrosas.',
      );
    });

    it('rechaza binario PE Windows (MZ) incluso renombrado como .pdf', () => {
      // Cabecera DOS MZ típica de ejecutables PE (0x4D, 0x5A)
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00]);
      const disguisedExe = makeFile(
        'cedula_falsa.pdf',
        'application/pdf',
        exeBuffer,
      );

      expect(() => validateSolicitudDocument(disguisedExe)).toThrow(
        'El contenido del archivo corresponde a un formato ejecutable no permitido.',
      );
    });

    it('rechaza binario Linux ELF incluso renombrado como .png', () => {
      // Cabecera ELF (\x7fELF)
      const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01]);
      const disguisedElf = makeFile('plano.png', 'image/png', elfBuffer);

      expect(() => validateSolicitudDocument(disguisedElf)).toThrow(
        'El contenido del archivo corresponde a un formato ejecutable no permitido.',
      );
    });

    it('rechaza script con shebang (#!) incluso renombrado como .jpg', () => {
      const scriptBuffer = Buffer.from('#!/bin/bash\nrm -rf /\n');
      const disguisedScript = makeFile('foto.jpg', 'image/jpeg', scriptBuffer);

      expect(() => validateSolicitudDocument(disguisedScript)).toThrow(
        'El contenido del archivo corresponde a un formato ejecutable no permitido.',
      );
    });
  });

  describe('4. Cambiar solamente la extensión no evita la validación (Magic Bytes)', () => {
    it('rechaza un archivo de texto renombrado a .pdf', () => {
      const fakePdf = makeFile(
        'documento.pdf',
        'application/pdf',
        Buffer.from('Este es un archivo de texto simple y no un PDF real.'),
      );
      expect(() => validateSolicitudDocument(fakePdf)).toThrow(
        'El contenido del archivo no coincide con su formato declarado.',
      );
    });

    it('rechaza un archivo HTML renombrado a .png', () => {
      const fakePng = makeFile(
        'imagen.png',
        'image/png',
        Buffer.from('<html><body>Fake Image</body></html>'),
      );
      expect(() => validateSolicitudDocument(fakePng)).toThrow(
        'El contenido del archivo no coincide con su formato declarado.',
      );
    });

    it('rechaza un archivo con extensión .jpg cuyo MIME sea application/pdf', () => {
      const mismatch = makeFile(
        'documento.jpg',
        'application/pdf',
        validPdfBuffer,
      );
      expect(() => validateSolicitudDocument(mismatch)).toThrow(
        'Solo se permiten archivos PDF, JPG o PNG con una extensión válida.',
      );
    });
  });

  describe('5. Prevención de Path Traversal', () => {
    it.each([
      ['secuencia ../', '../../etc/passwd.pdf'],
      ['secuencia ..\\', '..\\..\\Windows\\System32\\calc.pdf'],
      ['ruta absoluta unix', '/var/www/uploads/shell.pdf'],
      ['ruta absoluta windows', 'C:\\inetpub\\wwwroot\\cmd.pdf'],
      ['carácter nulo', 'cedula.pdf\0.exe'],
    ])('rechaza intento de path traversal: %s', (_desc, maliciousName) => {
      const file = makeFile(
        maliciousName,
        'application/pdf',
        validPdfBuffer,
      );
      expect(() => validateSolicitudDocument(file)).toThrow(
        'El nombre original del archivo contiene caracteres o secuencias no permitidas.',
      );
    });
  });

  describe('6. Almacenamiento seguro, nombres internos únicos y prevención de sobrescrituras', () => {
    let savedRuta: string;

    afterEach(() => {
      if (savedRuta) {
        deleteSolicitudDocumentFile(savedRuta);
      }
    });

    it('genera nombre interno único y devuelve ruta relativa segura sin exponer rutas internas del sistema', () => {
      const pdf = makeFile('mi_cedula.pdf', 'application/pdf', validPdfBuffer);
      const resultado = saveSolicitudDocumentPending(pdf);
      savedRuta = resultado.rutaReferenciaArchivo;

      expect(resultado.filename).toMatch(/^\d+-[a-f0-9-]+\.pdf$/);
      expect(resultado.rutaReferenciaArchivo).toBe(
        `/uploads/solicitudes/pendientes/${resultado.filename}`,
      );
      // No expone rutas internas del SO en la referencia devuelta
      expect(resultado.rutaReferenciaArchivo).not.toContain('C:');
      expect(resultado.rutaReferenciaArchivo).not.toContain('\\');
      expect(resultado.rutaReferenciaArchivo.startsWith('/uploads/solicitudes/pendientes/')).toBe(true);
      expect(existsSync(resultado.absolutePath)).toBe(true);
    });

    it('dos archivos con el mismo nombre original reciben nombres internos distintos (evita colisiones y sobrescrituras)', () => {
      const pdf1 = makeFile('cedula.pdf', 'application/pdf', validPdfBuffer);
      const pdf2 = makeFile('cedula.pdf', 'application/pdf', validPdfBuffer);

      const res1 = saveSolicitudDocumentPending(pdf1);
      const res2 = saveSolicitudDocumentPending(pdf2);

      try {
        expect(res1.filename).not.toBe(res2.filename);
        expect(res1.rutaReferenciaArchivo).not.toBe(res2.rutaReferenciaArchivo);
        expect(existsSync(res1.absolutePath)).toBe(true);
        expect(existsSync(res2.absolutePath)).toBe(true);
      } finally {
        deleteSolicitudDocumentFile(res1.rutaReferenciaArchivo);
        deleteSolicitudDocumentFile(res2.rutaReferenciaArchivo);
      }
    });

    it('vincula el archivo pendiente a la carpeta definitiva de la solicitud y previene path traversal', () => {
      const pdf = makeFile('doc.pdf', 'application/pdf', validPdfBuffer);
      const pending = saveSolicitudDocumentPending(pdf);

      const linked = linkSolicitudDocumentFile(99, pending.rutaReferenciaArchivo);

      try {
        expect(linked.rutaReferenciaArchivo).toBe(
          `/uploads/solicitudes/99/${linked.filename}`,
        );
        expect(linked.rutaReferenciaArchivo.startsWith('/uploads/solicitudes/99/')).toBe(true);
        // El archivo original en pendientes ya no existe (se movió)
        expect(existsSync(pending.absolutePath)).toBe(false);
      } finally {
        deleteSolicitudDocumentFile(linked.rutaReferenciaArchivo);
      }
    });

    it('rechaza linkSolicitudDocumentFile con rutas pendientes inválidas o maliciosas', () => {
      expect(() =>
        linkSolicitudDocumentFile(1, '/uploads/otra_carpeta/archivo.pdf'),
      ).toThrow('La ruta del documento pendiente no es válida.');

      expect(() =>
        linkSolicitudDocumentFile(1, '/uploads/solicitudes/pendientes/../secreto.txt'),
      ).toThrow('Nombre de archivo pendiente inválido.');
    });
  });
});
