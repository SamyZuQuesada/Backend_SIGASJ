import { BadRequestException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import {
  EstadoAlertaReposicion,
  ESTADO_ALERTA_REPOSICION_LABELS,
  isEstadoAlertaReposicionValido,
} from '../../../common/enums/estado-alerta-reposicion.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { AlertaReposicion } from './alerta-reposicion.entity';
import { Material } from './material.entity';

describe('AlertaReposicion Entity (Inventario ASADA)', () => {
  describe('Enum EstadoAlertaReposicion', () => {
    it('debe definir los estados PENDIENTE, EN_GESTION y RESUELTA', () => {
      expect(EstadoAlertaReposicion.PENDIENTE).toBe('PENDIENTE');
      expect(EstadoAlertaReposicion.EN_GESTION).toBe('EN_GESTION');
      expect(EstadoAlertaReposicion.RESUELTA).toBe('RESUELTA');
    });

    it('debe contener las etiquetas descriptivas legibles', () => {
      expect(
        ESTADO_ALERTA_REPOSICION_LABELS[EstadoAlertaReposicion.PENDIENTE],
      ).toBe('Pendiente');
      expect(
        ESTADO_ALERTA_REPOSICION_LABELS[EstadoAlertaReposicion.EN_GESTION],
      ).toBe('En gestión');
      expect(
        ESTADO_ALERTA_REPOSICION_LABELS[EstadoAlertaReposicion.RESUELTA],
      ).toBe('Resuelta');
    });

    it('debe validar estados correctamente con isEstadoAlertaReposicionValido', () => {
      expect(isEstadoAlertaReposicionValido('PENDIENTE')).toBe(true);
      expect(isEstadoAlertaReposicionValido('EN_GESTION')).toBe(true);
      expect(isEstadoAlertaReposicionValido('RESUELTA')).toBe(true);
      expect(isEstadoAlertaReposicionValido('CANCELADA')).toBe(false);
      expect(isEstadoAlertaReposicionValido('')).toBe(false);
    });
  });

  describe('Instanciación y atributos', () => {
    it('debe existir la clase AlertaReposicion', () => {
      expect(AlertaReposicion).toBeDefined();
    });

    it('debe permitir instanciar una alerta vinculada a un Material sin duplicar sus datos maestros', () => {
      const material = new Material();
      material.id = 4;
      material.nombre = 'Tubo PVC 1/2"';
      material.unidadMedida = 'Metro';
      material.stockActual = 3;
      material.stockMinimo = 10;

      const alerta = new AlertaReposicion();
      const fecha = new Date('2026-09-14T18:00:00Z');

      alerta.id = 1;
      alerta.idMaterial = 4;
      alerta.material = material;
      alerta.stockActual = 3;
      alerta.stockMinimo = 10;
      alerta.estado = EstadoAlertaReposicion.PENDIENTE;
      alerta.fechaGeneracion = fecha;
      alerta.idUsuarioGestiona = null;
      alerta.usuarioGestiona = null;
      alerta.createdAt = fecha;
      alerta.updatedAt = fecha;

      expect(alerta.id).toBe(1);
      expect(alerta.idMaterial).toBe(4);
      expect(alerta.material).toBe(material);
      expect(alerta.material.nombre).toBe('Tubo PVC 1/2"');
      expect(alerta.stockActual).toBe(3);
      expect(alerta.stockMinimo).toBe(10);
      expect(alerta.estado).toBe(EstadoAlertaReposicion.PENDIENTE);
      expect(alerta.fechaGeneracion).toEqual(fecha);
      expect(alerta.idUsuarioGestiona).toBeNull();
      expect(alerta.usuarioGestiona).toBeNull();
      expect((alerta as unknown as { nombre?: string }).nombre).toBeUndefined();
    });

    it('debe permitir relacionar opcionalmente el usuario que gestiona la alerta', () => {
      const administrador = new Usuario();
      administrador.idUsuario = 2;

      const alerta = new AlertaReposicion();
      alerta.estado = EstadoAlertaReposicion.EN_GESTION;
      alerta.idUsuarioGestiona = 2;
      alerta.usuarioGestiona = administrador;

      expect(alerta.estado).toBe(EstadoAlertaReposicion.EN_GESTION);
      expect(alerta.idUsuarioGestiona).toBe(2);
      expect(alerta.usuarioGestiona).toBe(administrador);
    });
  });

  describe('Validaciones y hooks (@BeforeInsert / @BeforeUpdate)', () => {
    it('debe asignar fechaGeneracion, estado PENDIENTE e idUsuarioGestiona nulo en BeforeInsert si no fueron provistos', () => {
      const alerta = new AlertaReposicion();
      alerta.asignarValoresIniciales();

      expect(alerta.fechaGeneracion).toBeInstanceOf(Date);
      expect(alerta.estado).toBe(EstadoAlertaReposicion.PENDIENTE);
      expect(alerta.idUsuarioGestiona).toBeNull();
    });

    it('debe lanzar BadRequestException si el estado no es válido', () => {
      const alerta = new AlertaReposicion();
      alerta.estado = 'ESTADO_INEXISTENTE' as unknown as EstadoAlertaReposicion;

      expect(() => alerta.validar()).toThrow(BadRequestException);
      expect(() => alerta.validar()).toThrow(
        'Estado de alerta no válido: ESTADO_INEXISTENTE',
      );
    });

    it('debe validar que stockActual y stockMinimo sean enteros mayores o iguales a cero', () => {
      const alerta = new AlertaReposicion();
      alerta.estado = EstadoAlertaReposicion.PENDIENTE;
      alerta.stockActual = -1;
      alerta.stockMinimo = 5;

      expect(() => alerta.validar()).toThrow(BadRequestException);
      expect(() => alerta.validar()).toThrow(
        'El stock actual de la alerta debe ser un entero mayor o igual a cero',
      );

      alerta.stockActual = 2.5;
      expect(() => alerta.validar()).toThrow(BadRequestException);

      alerta.stockActual = 0;
      alerta.stockMinimo = -3;
      expect(() => alerta.validar()).toThrow(
        'El stock mínimo de la alerta debe ser un entero mayor o igual a cero',
      );

      alerta.stockMinimo = 8;
      expect(() => alerta.validar()).not.toThrow();
    });
  });

  describe('Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();

    it('debe estar registrada la tabla AlertaReposicion', () => {
      const table = storage.tables.find(
        (t) => t.target === AlertaReposicion || t.name === 'AlertaReposicion',
      );
      expect(table).toBeDefined();
      expect(table?.name).toBe('AlertaReposicion');
    });

    it('debe tener llave primaria autoincremental id', () => {
      const primaryCol = storage.columns.find(
        (c) => c.target === AlertaReposicion && c.propertyName === 'id',
      );
      expect(primaryCol).toBeDefined();
      const generated = storage.generations.find(
        (g) => g.target === AlertaReposicion && g.propertyName === 'id',
      );
      expect(generated?.strategy).toBe('increment');
    });

    it('debe tener configuradas todas las columnas requeridas', () => {
      const columns = storage.columns
        .filter((c) => c.target === AlertaReposicion)
        .map((c) => c.propertyName);

      expect(columns).toContain('id');
      expect(columns).toContain('idMaterial');
      expect(columns).toContain('stockActual');
      expect(columns).toContain('stockMinimo');
      expect(columns).toContain('estado');
      expect(columns).toContain('fechaGeneracion');
      expect(columns).toContain('idUsuarioGestiona');
      expect(columns).toContain('createdAt');
      expect(columns).toContain('updatedAt');
      expect(columns).not.toContain('nombre');
      expect(columns).not.toContain('categoria');
      expect(columns).not.toContain('unidadMedida');
    });

    it('debe relacionar el material de forma obligatoria', () => {
      const relation = storage.relations.find(
        (r) => r.target === AlertaReposicion && r.propertyName === 'material',
      );
      expect(relation).toBeDefined();
      expect(relation?.relationType).toBe('many-to-one');
      expect(relation?.options.nullable).toBe(false);

      const join = storage.joinColumns.find(
        (j) => j.target === AlertaReposicion && j.propertyName === 'material',
      );
      expect(join?.name).toBe('idMaterial');
    });

    it('debe relacionar opcionalmente con el usuario que gestiona la alerta', () => {
      const relation = storage.relations.find(
        (r) =>
          r.target === AlertaReposicion && r.propertyName === 'usuarioGestiona',
      );
      expect(relation).toBeDefined();
      expect(relation?.relationType).toBe('many-to-one');
      expect(relation?.options.nullable).toBe(true);
      expect(relation?.options.onDelete).toBe('SET NULL');

      const join = storage.joinColumns.find(
        (j) =>
          j.target === AlertaReposicion && j.propertyName === 'usuarioGestiona',
      );
      expect(join?.name).toBe('idUsuarioGestiona');
      expect(join?.referencedColumnName).toBe('idUsuario');
    });

    it('debe usar createdAt y updatedAt como fechas de auditoría', () => {
      const created = storage.columns.find(
        (c) => c.target === AlertaReposicion && c.propertyName === 'createdAt',
      );
      const updated = storage.columns.find(
        (c) => c.target === AlertaReposicion && c.propertyName === 'updatedAt',
      );
      expect(created?.mode).toBe('createDate');
      expect(updated?.mode).toBe('updateDate');
    });
  });
});
