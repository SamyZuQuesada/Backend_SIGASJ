import { getMetadataArgsStorage } from 'typeorm';
import {
  EstadoAveria,
  ESTADO_AVERIA_LABELS,
  isEstadoAveriaValido,
} from '../../../common/enums/estado-averia.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Averia } from './averia.entity';

describe('Averia Entity (Gestión de Averías)', () => {
  describe('Enum EstadoAveria', () => {
    it('define el estado inicial RECIBIDA con etiqueta Recibida', () => {
      expect(EstadoAveria.RECIBIDA).toBe('RECIBIDA');
      expect(ESTADO_AVERIA_LABELS[EstadoAveria.RECIBIDA]).toBe('Recibida');
      expect(isEstadoAveriaValido('RECIBIDA')).toBe(true);
      expect(isEstadoAveriaValido('INVENTADO')).toBe(false);
    });
  });

  describe('Instanciación y atributos', () => {
    it('debe existir la clase Averia', () => {
      expect(Averia).toBeDefined();
    });

    it('permite persistir un reporte mínimo sin datos administrativos', () => {
      const averia = new Averia();
      const ahora = new Date('2026-09-11T18:00:00Z');

      averia.id = 1;
      averia.codigoSeguimiento = 'AVR-2026-0001';
      averia.fechaReporte = ahora;
      averia.nombreReportante = 'Ana Vargas';
      averia.identificacionReportante = null;
      averia.telefonoReportante = '2680-4455';
      averia.correoReportante = null;
      averia.idAbonado = null;
      averia.ubicacion = 'Frente a la pulpería, 50 m sur, casa verde';
      averia.sectorComunidad = 'San Juan Centro';
      averia.descripcion = 'Baja presión y fuga visible en la acera';
      averia.estado = EstadoAveria.RECIBIDA;
      averia.tipoAveria = null;
      averia.prioridad = null;
      averia.idFontaneroAsignado = null;
      averia.fontaneroAsignado = null;
      averia.fechaAsignacion = null;
      averia.fechaInicioAtencion = null;
      averia.fechaResolucion = null;
      averia.observacionesAtencion = null;
      averia.createdAt = ahora;
      averia.updatedAt = ahora;

      expect(averia.codigoSeguimiento).toBe('AVR-2026-0001');
      expect(averia.nombreReportante).toBe('Ana Vargas');
      expect(averia.telefonoReportante).toBe('2680-4455');
      expect(averia.identificacionReportante).toBeNull();
      expect(averia.correoReportante).toBeNull();
      expect(averia.idAbonado).toBeNull();
      expect(averia.tipoAveria).toBeNull();
      expect(averia.prioridad).toBeNull();
      expect(averia.fontaneroAsignado).toBeNull();
      expect(averia.fechaAsignacion).toBeNull();
      expect(averia.fechaInicioAtencion).toBeNull();
      expect(averia.fechaResolucion).toBeNull();
      expect(averia.observacionesAtencion).toBeNull();
      expect(averia.estado).toBe(EstadoAveria.RECIBIDA);
    });

    it('permite relacionar un Abonado por id sin perder los datos directos del Reportante', () => {
      const averia = new Averia();
      averia.nombreReportante = 'Carlos Mora';
      averia.telefonoReportante = '8888-1111';
      averia.idAbonado = 42;

      expect(averia.idAbonado).toBe(42);
      expect(averia.nombreReportante).toBe('Carlos Mora');
      expect(averia.telefonoReportante).toBe('8888-1111');
    });

    it('permite asociar después un Fontanero (Usuario) sin cascade', () => {
      const fontanero = new Usuario();
      fontanero.idUsuario = 7;

      const averia = new Averia();
      averia.fontaneroAsignado = null;
      expect(averia.fontaneroAsignado).toBeNull();

      averia.idFontaneroAsignado = 7;
      averia.fontaneroAsignado = fontanero;
      averia.fechaAsignacion = new Date('2026-09-12T08:00:00Z');

      expect(averia.fontaneroAsignado).toBe(fontanero);
      expect(averia.idFontaneroAsignado).toBe(7);
    });

    it('genera fechaReporte en BeforeInsert si no viene asignada', () => {
      const averia = new Averia();
      averia.asignarFechaReporte();
      expect(averia.fechaReporte).toBeInstanceOf(Date);
    });
  });

  describe('Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();

    it('está registrada como entidad con el nombre Averia', () => {
      const table = storage.tables.find(
        (t) => t.target === Averia || t.name === 'Averia',
      );
      expect(table).toBeDefined();
      expect(table?.name).toBe('Averia');
    });

    it('tiene llave primaria autoincremental id', () => {
      const primaryCol = storage.columns.find(
        (c) => c.target === Averia && c.propertyName === 'id',
      );
      expect(primaryCol).toBeDefined();
      const generated = storage.generations.find(
        (g) => g.target === Averia && g.propertyName === 'id',
      );
      expect(generated).toBeDefined();
      expect(generated?.strategy).toBe('increment');
    });

    it('declara codigoSeguimiento único y los campos obligatorios/opcionales', () => {
      const columns = storage.columns.filter((c) => c.target === Averia);
      const byName = new Map(columns.map((c) => [c.propertyName, c]));

      expect(byName.get('codigoSeguimiento')?.options.unique).toBe(true);
      expect(byName.get('codigoSeguimiento')?.options.nullable).not.toBe(true);
      expect(byName.get('nombreReportante')?.options.nullable).not.toBe(true);
      expect(byName.get('telefonoReportante')?.options.nullable).not.toBe(true);
      expect(byName.get('ubicacion')?.options.nullable).not.toBe(true);
      expect(byName.get('sectorComunidad')?.options.nullable).not.toBe(true);
      expect(byName.get('descripcion')?.options.nullable).not.toBe(true);

      expect(byName.get('identificacionReportante')?.options.nullable).toBe(
        true,
      );
      expect(byName.get('correoReportante')?.options.nullable).toBe(true);
      expect(byName.get('idAbonado')?.options.nullable).toBe(true);
      expect(byName.get('tipoAveria')?.options.nullable).toBe(true);
      expect(byName.get('prioridad')?.options.nullable).toBe(true);
      expect(byName.get('idFontaneroAsignado')?.options.nullable).toBe(true);
      expect(byName.get('fechaAsignacion')?.options.nullable).toBe(true);
      expect(byName.get('fechaInicioAtencion')?.options.nullable).toBe(true);
      expect(byName.get('fechaResolucion')?.options.nullable).toBe(true);
      expect(byName.get('observacionesAtencion')?.options.nullable).toBe(true);
    });

    it('usa createdAt y updatedAt como auditoría automática', () => {
      const createdCol = storage.columns.find(
        (c) => c.target === Averia && c.propertyName === 'createdAt',
      );
      const updatedCol = storage.columns.find(
        (c) => c.target === Averia && c.propertyName === 'updatedAt',
      );

      expect(createdCol?.mode).toBe('createDate');
      expect(updatedCol?.mode).toBe('updateDate');
    });

    it('relaciona Fontanero asignado con Usuario de forma opcional y SET NULL', () => {
      const relation = storage.relations.find(
        (r) => r.target === Averia && r.propertyName === 'fontaneroAsignado',
      );
      expect(relation).toBeDefined();
      expect(relation?.relationType).toBe('many-to-one');
      expect(relation?.options.nullable).toBe(true);
      expect(relation?.options.onDelete).toBe('SET NULL');
      expect(relation?.options.cascade).not.toBe(true);

      const join = storage.joinColumns.find(
        (j) => j.target === Averia && j.propertyName === 'fontaneroAsignado',
      );
      expect(join?.name).toBe('idFontaneroAsignado');
      expect(join?.referencedColumnName).toBe('idUsuario');
    });

    it('no declara relación TypeORM hacia Abonado (entidad aún inexistente)', () => {
      const abonadoRel = storage.relations.find(
        (r) =>
          r.target === Averia &&
          (r.propertyName === 'abonado' || r.propertyName === 'idAbonado'),
      );
      expect(abonadoRel).toBeUndefined();
    });
  });
});
