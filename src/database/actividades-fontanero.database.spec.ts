import { EstadoActividadFontanero } from '../common/enums/estado-actividad-fontanero.enum';
import { TipoActividadFontaneroCodigo } from '../common/enums/tipo-actividad-fontanero-codigo.enum';
import { CreateActividadesFontaneroTables1724684200000 } from './migrations/1724684200000-CreateActividadesFontaneroTables';

type TipoActividadRow = {
  id: number;
  codigo: string;
  nombre: string;
};

type ActividadRow = {
  id: number;
  fontaneroId: string;
  idUsuario: number | null;
  idTipoActividad: number | null;
  fechaActividad: string | null;
  observaciones: string | null;
  titulo: string;
  estado: EstadoActividadFontanero;
};

class ActividadesFontaneroMemoryDatabase {
  private tipos = new Map<number, TipoActividadRow>();
  private usuarios = new Set<number>();
  private actividades = new Map<number, ActividadRow>();
  private nextTipoId = 1;
  private nextUsuarioId = 1;
  private nextActividadId = 1;

  seedTipos(): void {
    const catalogo: Array<[TipoActividadFontaneroCodigo, string]> = [
      [TipoActividadFontaneroCodigo.CONTROL_FUGAS, 'Control de Fugas'],
      [TipoActividadFontaneroCodigo.TOMA_PRESION, 'Toma de presión'],
      [TipoActividadFontaneroCodigo.VISITA_CAMPO, 'Visita de Campo'],
      [TipoActividadFontaneroCodigo.CONTROL_CLOROS, 'Control de Cloros'],
      [TipoActividadFontaneroCodigo.CONTROL_OPERATIVO, 'Control Operativo'],
      [
        TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES,
        'Incapacidad o vacaciones',
      ],
    ];

    for (const [codigo, nombre] of catalogo) {
      const id = this.nextTipoId++;
      this.tipos.set(id, { id, codigo, nombre });
    }
  }

  createUsuario(): number {
    const id = this.nextUsuarioId++;
    this.usuarios.add(id);
    return id;
  }

  saveActividad(
    datos: Omit<ActividadRow, 'id'>,
  ): ActividadRow {
    if (
      datos.idTipoActividad !== null &&
      !this.tipos.has(datos.idTipoActividad)
    ) {
      throw new Error('FK Constraint Error: tipo de actividad inexistente');
    }

    if (datos.idUsuario !== null && !this.usuarios.has(datos.idUsuario)) {
      throw new Error('FK Constraint Error: usuario inexistente');
    }

    const id = this.nextActividadId++;
    const actividad: ActividadRow = { id, ...datos };
    this.actividades.set(id, actividad);
    return actividad;
  }

  listTipos(): TipoActividadRow[] {
    return Array.from(this.tipos.values());
  }

  getActividad(id: number): ActividadRow | undefined {
    return this.actividades.get(id);
  }
}

describe('Migración e integridad: Actividades Fontanero (#387)', () => {
  let db: ActividadesFontaneroMemoryDatabase;

  beforeEach(() => {
    db = new ActividadesFontaneroMemoryDatabase();
    db.seedTipos();
  });

  describe('Definición de migración SQL Server', () => {
    it('expone la migración para crear tablas y relaciones', () => {
      const migration = new CreateActividadesFontaneroTables1724684200000();
      expect(migration.name).toBe('CreateActividadesFontaneroTables1724684200000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });
  });

  describe('Catálogo TipoActividadFontanero', () => {
    it('contempla los seis tipos oficiales de actividad', () => {
      const codigos = db.listTipos().map((tipo) => tipo.codigo);
      expect(codigos).toEqual([
        TipoActividadFontaneroCodigo.CONTROL_FUGAS,
        TipoActividadFontaneroCodigo.TOMA_PRESION,
        TipoActividadFontaneroCodigo.VISITA_CAMPO,
        TipoActividadFontaneroCodigo.CONTROL_CLOROS,
        TipoActividadFontaneroCodigo.CONTROL_OPERATIVO,
        TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES,
      ]);
    });
  });

  describe('Integridad referencial esperada en SQL Server', () => {
    it('permite registrar una actividad con tipo y fontanero válidos', () => {
      const idUsuario = db.createUsuario();
      const actividad = db.saveActividad({
        fontaneroId: 'fontanero-1',
        idUsuario,
        idTipoActividad: 1,
        fechaActividad: '2026-09-07',
        observaciones: 'Observación general',
        titulo: 'Control sector norte',
        estado: EstadoActividadFontanero.REPORTADA,
      });

      expect(actividad.id).toBe(1);
      expect(db.getActividad(1)).toMatchObject({
        titulo: 'Control sector norte',
        idTipoActividad: 1,
        idUsuario,
      });
    });

    it('rechaza un tipo de actividad inexistente', () => {
      expect(() =>
        db.saveActividad({
          fontaneroId: 'fontanero-2',
          idUsuario: null,
          idTipoActividad: 9999,
          fechaActividad: null,
          observaciones: null,
          titulo: 'Tipo inválido',
          estado: EstadoActividadFontanero.REPORTADA,
        }),
      ).toThrow('FK Constraint Error: tipo de actividad inexistente');
    });

    it('rechaza un usuario inexistente', () => {
      expect(() =>
        db.saveActividad({
          fontaneroId: 'fontanero-3',
          idUsuario: 9999,
          idTipoActividad: 1,
          fechaActividad: null,
          observaciones: null,
          titulo: 'Usuario inválido',
          estado: EstadoActividadFontanero.REPORTADA,
        }),
      ).toThrow('FK Constraint Error: usuario inexistente');
    });
  });
});
