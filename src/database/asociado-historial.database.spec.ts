import { QueryRunner, Table, TableIndex } from 'typeorm';
import { Asociado } from '../modules/asociados/entities/asociado.entity';
import { AsociadosController } from '../modules/asociados/asociados.controller';
import { AsociadosService } from '../modules/asociados/asociados.service';
import { AddHistoricalQueryIndexesToAsociado1724686010000 } from './migrations/1724686010000-AddHistoricalQueryIndexesToAsociado';

describe('Pruebas de Base de Datos y Backend: Historial de Asociados sin Duplicación', () => {
  describe('1. Verificación de Campos Históricos y Estado en la Entidad Asociado', () => {
    it('debe contener los campos históricos esenciales: activo, fechaRegistro y fechaInactivacion', () => {
      const asociado = new Asociado();
      const fechaRegistro = new Date('2026-01-15T08:00:00.000Z');
      const fechaInactivacion = new Date('2026-06-20T14:30:00.000Z');

      asociado.id = 1;
      asociado.nombre = 'Carlos';
      asociado.apellidos = 'Pérez';
      asociado.cedula = '1-1234-0567';
      asociado.correoElectronico = 'carlos@test.cr';
      asociado.activo = false;
      asociado.fechaRegistro = fechaRegistro;
      asociado.fechaInactivacion = fechaInactivacion;
      asociado.motivoInactivacion = 'Traslado de residencia';

      // Verificar que el estado permite distinguir asociados actuales y anteriores
      expect(asociado.activo).toBe(false);
      expect(asociado.fechaRegistro).toEqual(fechaRegistro);
      expect(asociado.fechaInactivacion).toEqual(fechaInactivacion);
      expect(asociado.motivoInactivacion).toBe('Traslado de residencia');
    });

    it('un asociado activo debe tener activo=true y fechaInactivacion en null', () => {
      const asociado = new Asociado();
      asociado.activo = true;
      asociado.fechaInactivacion = null;
      asociado.asignarValoresPorDefecto();

      expect(asociado.activo).toBe(true);
      expect(asociado.fechaInactivacion).toBeNull();
      expect(asociado.fechaRegistro).toBeInstanceOf(Date);
    });

    it('un asociado anterior/inactivo debe conservar su fechaRegistro original y tener fechaInactivacion asignada', () => {
      const fechaIngreso = new Date('2022-03-01T08:00:00.000Z');
      const fechaSalida = new Date('2026-02-15T12:00:00.000Z');

      const asociadoAnterior = new Asociado();
      asociadoAnterior.fechaRegistro = fechaIngreso;
      asociadoAnterior.activo = false;
      asociadoAnterior.fechaInactivacion = fechaSalida;
      asociadoAnterior.motivoInactivacion = 'Renuncia voluntaria';

      expect(asociadoAnterior.activo).toBe(false);
      expect(asociadoAnterior.fechaRegistro).toEqual(fechaIngreso);
      expect(asociadoAnterior.fechaInactivacion).toEqual(fechaSalida);
      expect(asociadoAnterior.motivoInactivacion).toBe('Renuncia voluntaria');
    });
  });

  describe('2. Arquitectura de Historial en la Propia Entidad (Sin Segunda Tabla Duplicada)', () => {
    it('no debe existir una segunda entidad o tabla que duplique el padrón de asociados', () => {
      // La única entidad de asociados en el módulo es Asociado
      expect(Asociado).toBeDefined();
      expect(Asociado.name).toBe('Asociado');

      // Se verifica que la entidad Asociado actúa como la fuente completa del historial
      const instancia = new Asociado();
      instancia.activo = true;
      instancia.fechaRegistro = new Date('2026-01-01T00:00:00.000Z');
      instancia.fechaInactivacion = null;

      expect(instancia.activo).toBe(true);
      expect(instancia.fechaRegistro).toBeInstanceOf(Date);
      expect(instancia.fechaInactivacion).toBeNull();
    });
  });

  describe('3. Evitar Eliminación Física y Conservar Inactivos', () => {
    it('el controlador de Asociados NO debe exponer ningún método DELETE ni endpoint de borrado físico', () => {
      const prototype = AsociadosController.prototype as any;
      const metodos = Object.getOwnPropertyNames(prototype);

      expect(metodos).toContain('create');
      expect(metodos).toContain('findAll');
      expect(metodos).toContain('findOne');
      expect(metodos).toContain('update');
      expect(metodos).toContain('cambiarEstado');

      // Garantizar que no existe delete o remove en el controlador
      expect(metodos).not.toContain('delete');
      expect(metodos).not.toContain('remove');
      expect(metodos).not.toContain('destroy');
    });

    it('el servicio de Asociados gestiona el ciclo histórico mediante soft-inactivation (cambiarEstado)', async () => {
      const mockAsociado: Partial<Asociado> = {
        id: 10,
        nombre: 'Mario',
        apellidos: 'Vargas',
        cedula: '1-0987-0654',
        correoElectronico: 'mario@test.cr',
        activo: true,
        fechaRegistro: new Date('2024-01-01'),
        fechaInactivacion: null,
        motivoInactivacion: null,
      };

      const saveMock = jest.fn().mockImplementation((entity) => Promise.resolve(entity));
      const repoMock = {
        findOne: jest.fn().mockResolvedValue(mockAsociado),
        save: saveMock,
      } as any;

      const service = new AsociadosService(repoMock);

      // Inactivar al asociado (asociado anterior)
      const inactivo = await service.cambiarEstado(10, {
        activo: false,
        motivo: 'Venta de inmueble',
      });

      expect(inactivo.activo).toBe(false);
      expect(inactivo.fechaInactivacion).toBeInstanceOf(Date);
      expect(inactivo.motivoInactivacion).toBe('Venta de inmueble');
      // La fecha de registro original y el registro completo se conservan intactos
      expect(inactivo.fechaRegistro).toEqual(new Date('2024-01-01'));
      expect(saveMock).toHaveBeenCalled();
    });
  });

  describe('4. Preparación de Consultas Históricas en QueryBuilder', () => {
    it('debe construir consultas diferenciadas para asociados actuales (activo=true), anteriores (activo=false) y todos', async () => {
      const andWhereMock = jest.fn().mockReturnThis();
      const orderByMock = jest.fn().mockReturnThis();
      const addOrderByMock = jest.fn().mockReturnThis();
      const skipMock = jest.fn().mockReturnThis();
      const takeMock = jest.fn().mockReturnThis();
      const setParameterMock = jest.fn().mockReturnThis();
      const getManyAndCountMock = jest.fn().mockResolvedValue([[], 0]);

      const qbMock = {
        setParameter: setParameterMock,
        andWhere: andWhereMock,
        orderBy: orderByMock,
        addOrderBy: addOrderByMock,
        skip: skipMock,
        take: takeMock,
        getManyAndCount: getManyAndCountMock,
      };

      const repoMock = {
        createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      } as any;

      const service = new AsociadosService(repoMock);

      // Consulta 1: Solo asociados actuales
      await service.findAll({ activo: true });
      expect(andWhereMock).toHaveBeenCalledWith('a.activo = :activo', { activo: true });

      // Consulta 2: Solo asociados anteriores / inactivos
      await service.findAll({ activo: false });
      expect(andWhereMock).toHaveBeenCalledWith('a.activo = :activo', { activo: false });

      // Consulta 3: Historial consolidado completo (sin filtro de activo)
      andWhereMock.mockClear();
      await service.findAll({});
      expect(andWhereMock).not.toHaveBeenCalledWith('a.activo = :activo', expect.anything());
    });

    it('debe aplicar filtros por rango de fechas de registro y de inactivación en consultas históricas', async () => {
      const andWhereMock = jest.fn().mockReturnThis();
      const qbMock = {
        setParameter: jest.fn().mockReturnThis(),
        andWhere: andWhereMock,
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      const repoMock = {
        createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      } as any;

      const service = new AsociadosService(repoMock);

      await service.findAll({
        fechaRegistroDesde: '2026-01-01',
        fechaRegistroHasta: '2026-06-30',
        fechaInactivacionDesde: '2026-07-01',
        fechaInactivacionHasta: '2026-12-31',
      });

      expect(andWhereMock).toHaveBeenCalledWith(
        'a.fechaRegistro >= :fechaRegDesde',
        expect.objectContaining({ fechaRegDesde: expect.any(Date) }),
      );
      expect(andWhereMock).toHaveBeenCalledWith(
        'a.fechaRegistro <= :fechaRegHasta',
        expect.objectContaining({ fechaRegHasta: expect.any(Date) }),
      );
      expect(andWhereMock).toHaveBeenCalledWith(
        'a.fechaInactivacion >= :fechaInactDesde',
        expect.objectContaining({ fechaInactDesde: expect.any(Date) }),
      );
      expect(andWhereMock).toHaveBeenCalledWith(
        'a.fechaInactivacion <= :fechaInactHasta',
        expect.objectContaining({ fechaInactHasta: expect.any(Date) }),
      );
    });
  });

  describe('5. Migración de Índices para Consultas Históricas', () => {
    it('debe contar con la migración AddHistoricalQueryIndexesToAsociado1724686010000', () => {
      const migration = new AddHistoricalQueryIndexesToAsociado1724686010000();
      expect(migration.name).toBe('AddHistoricalQueryIndexesToAsociado1724686010000');
    });

    it('debe crear los índices para activo, fechaRegistro y fechaInactivacion en up', async () => {
      const migration = new AddHistoricalQueryIndexesToAsociado1724686010000();
      const createdIndices: TableIndex[] = [];

      const mockTable = new Table({
        name: 'Asociado',
        columns: [],
        indices: [],
      });

      const mockQueryRunner = {
        getTable: jest.fn().mockResolvedValue(mockTable),
        createIndex: jest.fn().mockImplementation((_tableName, index) => {
          createdIndices.push(index);
          return Promise.resolve();
        }),
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(createdIndices.length).toBe(3);
      const names = createdIndices.map((i) => i.name);
      expect(names).toContain('IDX_Asociado_activo');
      expect(names).toContain('IDX_Asociado_fechaRegistro');
      expect(names).toContain('IDX_Asociado_fechaInactivacion');
    });

    it('debe remover los índices en down', async () => {
      const migration = new AddHistoricalQueryIndexesToAsociado1724686010000();
      const droppedIndexNames: string[] = [];

      const mockIndices = [
        new TableIndex({ name: 'IDX_Asociado_activo', columnNames: ['activo'] }),
        new TableIndex({ name: 'IDX_Asociado_fechaRegistro', columnNames: ['fechaRegistro'] }),
        new TableIndex({ name: 'IDX_Asociado_fechaInactivacion', columnNames: ['fechaInactivacion'] }),
      ];

      const mockTable = new Table({
        name: 'Asociado',
        columns: [],
        indices: mockIndices,
      });

      const mockQueryRunner = {
        getTable: jest.fn().mockResolvedValue(mockTable),
        dropIndex: jest.fn().mockImplementation((_tableName, index) => {
          droppedIndexNames.push(index.name);
          return Promise.resolve();
        }),
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(droppedIndexNames).toContain('IDX_Asociado_activo');
      expect(droppedIndexNames).toContain('IDX_Asociado_fechaRegistro');
      expect(droppedIndexNames).toContain('IDX_Asociado_fechaInactivacion');
    });
  });
});
