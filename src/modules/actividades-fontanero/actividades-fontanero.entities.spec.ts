import { DataSource } from 'typeorm';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';

describe('Entidades Actividades Fontanero (#386)', () => {
  jest.setTimeout(30000);
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqljs',
      entities: [
        ActividadFontanero,
        TipoActividadFontanero,
        DocumentoActividadFontanero,
        Usuario,
        Rol,
      ],
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('ActividadFontanero expone relación ManyToOne con TipoActividadFontanero', () => {
    const metadata = dataSource.getMetadata(ActividadFontanero);
    const relation = metadata.findRelationWithPropertyPath('tipoActividad');

    expect(relation).toBeDefined();
    expect(relation!.relationType).toBe('many-to-one');
    expect(relation!.inverseEntityMetadata.targetName).toBe(
      'TipoActividadFontanero',
    );
    expect(relation!.joinColumns[0]?.databaseName).toBe('idTipoActividad');
  });

  it('ActividadFontanero expone relación ManyToOne con Usuario (fontanero)', () => {
    const metadata = dataSource.getMetadata(ActividadFontanero);
    const relation = metadata.findRelationWithPropertyPath('fontanero');

    expect(relation).toBeDefined();
    expect(relation!.relationType).toBe('many-to-one');
    expect(relation!.inverseEntityMetadata.targetName).toBe('Usuario');
    expect(relation!.joinColumns[0]?.databaseName).toBe('idUsuario');
  });

  it('ActividadFontanero incluye fechaActividad, observaciones, estado y estadoRevision con defaults correctos', () => {
    const metadata = dataSource.getMetadata(ActividadFontanero);
    const columnNames = metadata.columns.map((column) => column.propertyName);

    expect(columnNames).toEqual(
      expect.arrayContaining([
        'fechaActividad',
        'observaciones',
        'datosEspecificos',
        'estado',
        'estadoRevision',
      ]),
    );

    const colEstado = metadata.findColumnWithPropertyName('estado');
    expect(colEstado?.default).toBe('REPORTADA');

    const colEstadoRevision =
      metadata.findColumnWithPropertyName('estadoRevision');
    expect(colEstadoRevision?.default).toBe('PENDIENTE');
  });

  it('TipoActividadFontanero expone relación OneToMany con ActividadFontanero', () => {
    const metadata = dataSource.getMetadata(TipoActividadFontanero);
    const relation = metadata.findRelationWithPropertyPath('actividades');

    expect(relation).toBeDefined();
    expect(relation!.relationType).toBe('one-to-many');
    expect(relation!.inverseEntityMetadata.targetName).toBe(
      'ActividadFontanero',
    );
  });
});
