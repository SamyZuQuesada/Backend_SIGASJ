import { normalizeMediaUrl } from './public-media';

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
});
