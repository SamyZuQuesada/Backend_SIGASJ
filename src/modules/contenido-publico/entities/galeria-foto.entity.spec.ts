import { getMetadataArgsStorage } from 'typeorm';
import { GaleriaFoto } from './galeria-foto.entity';

describe('GaleriaFoto Entity', () => {
  const storage = getMetadataArgsStorage();

  it('está registrada como entidad GaleriaFoto', () => {
    const table = storage.tables.find(
      (t) => t.target === GaleriaFoto || t.name === 'GaleriaFoto',
    );
    expect(table).toBeDefined();
    expect(table?.name).toBe('GaleriaFoto');
  });

  it('mapea id, url y activa a las columnas físicas de SQL Server', () => {
    const columns = storage.columns.filter((c) => c.target === GaleriaFoto);
    const byProperty = new Map(columns.map((c) => [c.propertyName, c]));

    expect(byProperty.get('id')?.options.name).toBe('idGaleriaFoto');
    expect(byProperty.get('url')?.options.name).toBe('imagenUrl');
    expect(byProperty.get('activa')?.options.name).toBe('activo');
  });
});
