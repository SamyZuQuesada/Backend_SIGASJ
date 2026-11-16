import { normalizeMediaUrl, streamPublicMedia } from './public-media';
import { bindMediaDataSource } from './media-blob.store';
import { NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';

describe('Media URL Normalization & Serving Rules', () => {
  it('convierte rutas internas de Windows a rutas públicas con /', () => {
    const windowsPath = 'C:\\proyecto\\uploads\\galeria\\tanque.jpg';
    expect(normalizeMediaUrl(windowsPath, 'galeria')).toBe(
      '/uploads/galeria/tanque.jpg',
    );
  });

  it('corrige rutas con barras invertidas relativas', () => {
    const backslashPath = '\\uploads\\galeria\\tanque.jpg';
    expect(normalizeMediaUrl(backslashPath, 'galeria')).toBe(
      '/uploads/galeria/tanque.jpg',
    );
  });

  it('normaliza rutas de comunicados', () => {
    const comunicadoPath = 'C:\\servidor\\uploads\\comunicados\\aviso.jpg';
    expect(normalizeMediaUrl(comunicadoPath, 'comunicados')).toBe(
      '/uploads/comunicados/aviso.jpg',
    );
  });

  it('elimina prefijo /api/v1/public/media/ para exponer directamente /uploads/', () => {
    const legacyPath = '/api/v1/public/media/galeria/tanque.jpg';
    expect(normalizeMediaUrl(legacyPath, 'galeria')).toBe(
      '/uploads/galeria/tanque.jpg',
    );
  });

  it('elimina duplicación de /api/v1/uploads/', () => {
    const duplicatePath = '/api/v1/uploads/galeria/tanque.jpg';
    expect(normalizeMediaUrl(duplicatePath, 'galeria')).toBe(
      '/uploads/galeria/tanque.jpg',
    );
  });

  it('convierte rutas de semilla /images/ a /uploads/ con la carpeta correspondiente', () => {
    expect(normalizeMediaUrl('/images/tanque.jpg', 'galeria')).toBe(
      '/uploads/galeria/tanque.jpg',
    );
    expect(normalizeMediaUrl('/images/aviso.jpg', 'comunicados')).toBe(
      '/uploads/comunicados/aviso.jpg',
    );
  });

  it('mantiene URLs externas completas intactas (http / https)', () => {
    const externalUrl = 'https://almacenamiento.example.com/galeria/tanque.jpg';
    expect(normalizeMediaUrl(externalUrl, 'galeria')).toBe(externalUrl);

    const httpUrl = 'http://cdn.example.com/comunicados/aviso.png';
    expect(normalizeMediaUrl(httpUrl, 'comunicados')).toBe(httpUrl);
  });

  it('mantiene rutas ya normalizadas con /uploads/', () => {
    expect(normalizeMediaUrl('/uploads/galeria/tanque.jpg', 'galeria')).toBe(
      '/uploads/galeria/tanque.jpg',
    );
    expect(
      normalizeMediaUrl('/uploads/comunicados/aviso.jpg', 'comunicados'),
    ).toBe('/uploads/comunicados/aviso.jpg');
  });

  it('retorna null para valores vacíos o indefinidos', () => {
    expect(normalizeMediaUrl(null)).toBeNull();
    expect(normalizeMediaUrl(undefined)).toBeNull();
    expect(normalizeMediaUrl('')).toBeNull();
    expect(normalizeMediaUrl('   ')).toBeNull();
  });

  describe('streamPublicMedia - Recuperación y Protección de Rutas', () => {
    let mockQuery: jest.Mock;

    beforeEach(() => {
      mockQuery = jest.fn();
      const mockDataSource = {
        options: { type: 'mssql' },
        query: mockQuery,
      } as unknown as DataSource;
      bindMediaDataSource(mockDataSource);
    });

    it('rechaza carpetas privadas como solicitudes con NotFoundException', async () => {
      await expect(
        streamPublicMedia('solicitudes', 'cedula.pdf'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza carpetas privadas como solicitudes-ausencia con NotFoundException', async () => {
      await expect(
        streamPublicMedia('solicitudes-ausencia', 'incapacidad.pdf'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza intentos de path traversal con .. o rutas maliciosas', async () => {
      await expect(
        streamPublicMedia('galeria', '../secretos.txt'),
      ).rejects.toThrow(NotFoundException);
    });

    it('recupera medios de comunicados desde dbo.ArchivoMedia cuando no están en disco', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          mime: 'image/jpeg',
          contenido: Buffer.from('contenido-jpeg-remoto'),
        },
      ]);

      const streamable = await streamPublicMedia(
        'comunicados',
        'archivo-inexistente-local.jpg',
      );
      expect(streamable).toBeDefined();
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][1]).toEqual([
        '/uploads/comunicados/archivo-inexistente-local.jpg',
      ]);
    });

    it('recupera fotos de proyectos desde dbo.ArchivoMedia cuando no están en disco', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          mime: 'image/jpeg',
          contenido: Buffer.from('contenido-proyecto-remoto'),
        },
      ]);

      const streamable = await streamPublicMedia(
        'proyectos',
        '1_cover_remoto.jpg',
      );
      expect(streamable).toBeDefined();
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][1]).toEqual([
        '/uploads/proyectos/1_cover_remoto.jpg',
      ]);
    });
  });
});
