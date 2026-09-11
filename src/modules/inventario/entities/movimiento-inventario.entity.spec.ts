import { BadRequestException } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { TipoMovimientoInventario } from '../../../common/enums/tipo-movimiento-inventario.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Material } from './material.entity';
import { MovimientoInventario } from './movimiento-inventario.entity';
import { Proveedor } from './proveedor.entity';

describe('MovimientoInventario Entity (Inventario ASADA)', () => {
  describe('1. Instanciación y Atributos Básicos', () => {
    it('debe existir la clase MovimientoInventario y el enum TipoMovimientoInventario', () => {
      expect(MovimientoInventario).toBeDefined();
      expect(TipoMovimientoInventario.ENTRADA).toBe('ENTRADA');
      expect(TipoMovimientoInventario.SALIDA).toBe('SALIDA');
    });

    it('debe permitir instanciar y asignar un movimiento de ENTRADA (reutilización)', () => {
      const movimiento = new MovimientoInventario();
      const fecha = new Date('2026-08-22T10:30:00Z');
      const fechaCreacion = new Date('2026-08-22T10:35:00Z');

      const material = new Material();
      material.id = 1;
      material.nombre = 'Tubo PVC 1/2"';

      const usuario = new Usuario();
      usuario.idUsuario = 2;

      const proveedor = new Proveedor();
      proveedor.id = 5;
      proveedor.nombre = 'Ferretería El Lagar';

      movimiento.id = 101;
      movimiento.tipo = TipoMovimientoInventario.ENTRADA;
      movimiento.cantidad = 30;
      movimiento.fechaMovimiento = fecha;
      movimiento.observacion = 'Ingreso de compra según factura F-4589';
      movimiento.idMaterial = 1;
      movimiento.material = material;
      movimiento.idUsuario = 2;
      movimiento.usuario = usuario;
      movimiento.idProveedor = 5;
      movimiento.proveedor = proveedor;
      movimiento.createdAt = fechaCreacion;

      expect(movimiento.id).toBe(101);
      expect(movimiento.tipo).toBe(TipoMovimientoInventario.ENTRADA);
      expect(movimiento.cantidad).toBe(30);
      expect(movimiento.fechaMovimiento).toEqual(fecha);
      expect(movimiento.observacion).toBe('Ingreso de compra según factura F-4589');
      expect(movimiento.idMaterial).toBe(1);
      expect(movimiento.material).toBe(material);
      expect(movimiento.idUsuario).toBe(2);
      expect(movimiento.usuario).toBe(usuario);
      expect(movimiento.idProveedor).toBe(5);
      expect(movimiento.proveedor).toBe(proveedor);
      expect(movimiento.createdAt).toEqual(fechaCreacion);
    });

    it('debe permitir instanciar y asignar un movimiento de SALIDA reutilizando el mismo modelo', () => {
      const movimiento = new MovimientoInventario();
      const fecha = new Date('2026-08-23T14:15:00Z');

      const material = new Material();
      material.id = 1;
      material.nombre = 'Tubo PVC 1/2"';

      const usuario = new Usuario();
      usuario.idUsuario = 3;

      movimiento.id = 102;
      movimiento.tipo = TipoMovimientoInventario.SALIDA;
      movimiento.cantidad = 5;
      movimiento.fechaMovimiento = fecha;
      movimiento.observacion = 'Despacho a fontanero para reparación de fuga en sector centro';
      movimiento.idMaterial = 1;
      movimiento.material = material;
      movimiento.idUsuario = 3;
      movimiento.usuario = usuario;
      movimiento.idAveria = 88; // Referencia opcional a avería
      movimiento.idProveedor = null;

      expect(movimiento.id).toBe(102);
      expect(movimiento.tipo).toBe(TipoMovimientoInventario.SALIDA);
      expect(movimiento.cantidad).toBe(5);
      expect(movimiento.fechaMovimiento).toEqual(fecha);
      expect(movimiento.observacion).toBe(
        'Despacho a fontanero para reparación de fuga en sector centro',
      );
      expect(movimiento.idMaterial).toBe(1);
      expect(movimiento.idUsuario).toBe(3);
      expect(movimiento.idAveria).toBe(88);
      expect(movimiento.idProveedor).toBeNull();
    });

    it('debe permitir almacenar campos opcionales nulos', () => {
      const movimiento = new MovimientoInventario();
      movimiento.tipo = TipoMovimientoInventario.SALIDA;
      movimiento.cantidad = 2;
      movimiento.observacion = null;
      movimiento.idProveedor = null;
      movimiento.idAveria = null;
      movimiento.idSolicitud = null;
      movimiento.idProyecto = null;

      expect(movimiento.observacion).toBeNull();
      expect(movimiento.idProveedor).toBeNull();
      expect(movimiento.idAveria).toBeNull();
      expect(movimiento.idSolicitud).toBeNull();
      expect(movimiento.idProyecto).toBeNull();
    });
  });

  describe('2. Validaciones de Integridad (@BeforeInsert / @BeforeUpdate)', () => {
    it('debe validar exitosamente y sanitizar la observación con trim', () => {
      const movimiento = new MovimientoInventario();
      movimiento.tipo = TipoMovimientoInventario.ENTRADA;
      movimiento.cantidad = 10;
      movimiento.observacion = '   Compra de stock mínimo   ';

      movimiento.validar();

      expect(movimiento.observacion).toBe('Compra de stock mínimo');
      expect(movimiento.fechaMovimiento).toBeInstanceOf(Date);
    });

    it('debe convertir observación vacía o solo espacios a null', () => {
      const movimiento = new MovimientoInventario();
      movimiento.tipo = TipoMovimientoInventario.SALIDA;
      movimiento.cantidad = 1;
      movimiento.observacion = '    ';

      movimiento.validar();

      expect(movimiento.observacion).toBeNull();
    });

    it('debe asignar fechaMovimiento actual por defecto si no fue provista', () => {
      const movimiento = new MovimientoInventario();
      movimiento.tipo = TipoMovimientoInventario.ENTRADA;
      movimiento.cantidad = 20;

      const antes = new Date();
      movimiento.validar();
      const despues = new Date();

      expect(movimiento.fechaMovimiento).toBeDefined();
      expect(movimiento.fechaMovimiento.getTime()).toBeGreaterThanOrEqual(
        antes.getTime(),
      );
      expect(movimiento.fechaMovimiento.getTime()).toBeLessThanOrEqual(
        despues.getTime(),
      );
    });

    it('debe lanzar BadRequestException si la cantidad es cero o negativa', () => {
      const movCero = new MovimientoInventario();
      movCero.tipo = TipoMovimientoInventario.ENTRADA;
      movCero.cantidad = 0;

      expect(() => movCero.validar()).toThrow(BadRequestException);
      expect(() => movCero.validar()).toThrow(
        'La cantidad del movimiento debe ser mayor a cero',
      );

      const movNegativo = new MovimientoInventario();
      movNegativo.tipo = TipoMovimientoInventario.SALIDA;
      movNegativo.cantidad = -5;

      expect(() => movNegativo.validar()).toThrow(BadRequestException);
      expect(() => movNegativo.validar()).toThrow(
        'La cantidad del movimiento debe ser mayor a cero',
      );
    });

    it('debe lanzar BadRequestException si la cantidad no es un número entero', () => {
      const movDecimal = new MovimientoInventario();
      movDecimal.tipo = TipoMovimientoInventario.ENTRADA;
      movDecimal.cantidad = 3.5;

      expect(() => movDecimal.validar()).toThrow(BadRequestException);
      expect(() => movDecimal.validar()).toThrow(
        'La cantidad del movimiento debe ser un número entero',
      );
    });

    it('debe lanzar BadRequestException si el tipo de movimiento no es ENTRADA ni SALIDA', () => {
      const movInvalido = new MovimientoInventario();
      movInvalido.tipo = 'TRANSFERENCIA' as any;
      movInvalido.cantidad = 5;

      expect(() => movInvalido.validar()).toThrow(BadRequestException);
      expect(() => movInvalido.validar()).toThrow(
        `El tipo de movimiento debe ser ${TipoMovimientoInventario.ENTRADA} o ${TipoMovimientoInventario.SALIDA}`,
      );
    });
  });

  describe('3. Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();

    it('debe estar registrada como entidad con el nombre "MovimientoInventario"', () => {
      const table = storage.tables.find(
        (t) => t.target === MovimientoInventario || t.name === 'MovimientoInventario',
      );
      expect(table).toBeDefined();
      expect(table?.name).toBe('MovimientoInventario');
    });

    it('debe tener configurada la llave primaria autoincremental "id"', () => {
      const primaryCol = storage.columns.find(
        (c) => c.target === MovimientoInventario && c.propertyName === 'id',
      );
      expect(primaryCol).toBeDefined();

      const generated = storage.generations.find(
        (g) => g.target === MovimientoInventario && g.propertyName === 'id',
      );
      expect(generated).toBeDefined();
      expect(generated?.strategy).toBe('increment');
    });

    it('debe tener configuradas todas las columnas requeridas', () => {
      const columns = storage.columns
        .filter((c) => c.target === MovimientoInventario)
        .map((c) => c.propertyName);

      expect(columns).toContain('id');
      expect(columns).toContain('tipo');
      expect(columns).toContain('cantidad');
      expect(columns).toContain('fechaMovimiento');
      expect(columns).toContain('observacion');
      expect(columns).toContain('idMaterial');
      expect(columns).toContain('idUsuario');
      expect(columns).toContain('idProveedor');
      expect(columns).toContain('idAveria');
      expect(columns).toContain('idSolicitud');
      expect(columns).toContain('idProyecto');
      expect(columns).toContain('createdAt');
    });

    it('debe registrar createdAt como columna automática de fecha', () => {
      const createdCol = storage.columns.find(
        (c) => c.target === MovimientoInventario && c.propertyName === 'createdAt',
      );
      expect(createdCol?.mode).toBe('createDate');
    });

    it('debe configurar relación ManyToOne con Material', () => {
      const relation = storage.relations.find(
        (r) =>
          r.target === MovimientoInventario &&
          r.propertyName === 'material' &&
          r.relationType === 'many-to-one',
      );
      expect(relation).toBeDefined();
      expect(relation?.options?.nullable).toBe(false);

      const joinCol = storage.joinColumns.find(
        (jc) => jc.target === MovimientoInventario && jc.propertyName === 'material',
      );
      expect(joinCol).toBeDefined();
      expect(joinCol?.name).toBe('idMaterial');
    });

    it('debe configurar relación ManyToOne con Usuario responsable', () => {
      const relation = storage.relations.find(
        (r) =>
          r.target === MovimientoInventario &&
          r.propertyName === 'usuario' &&
          r.relationType === 'many-to-one',
      );
      expect(relation).toBeDefined();
      expect(relation?.options?.nullable).toBe(false);

      const joinCol = storage.joinColumns.find(
        (jc) => jc.target === MovimientoInventario && jc.propertyName === 'usuario',
      );
      expect(joinCol).toBeDefined();
      expect(joinCol?.name).toBe('idUsuario');
    });

    it('debe configurar relación opcional ManyToOne con Proveedor', () => {
      const relation = storage.relations.find(
        (r) =>
          r.target === MovimientoInventario &&
          r.propertyName === 'proveedor' &&
          r.relationType === 'many-to-one',
      );
      expect(relation).toBeDefined();
      expect(relation?.options?.nullable).toBe(true);

      const joinCol = storage.joinColumns.find(
        (jc) => jc.target === MovimientoInventario && jc.propertyName === 'proveedor',
      );
      expect(joinCol).toBeDefined();
      expect(joinCol?.name).toBe('idProveedor');
    });

    it('debe reflejar la relación inversa OneToMany en la entidad Material', () => {
      const relation = storage.relations.find(
        (r) =>
          r.target === Material &&
          r.propertyName === 'movimientos' &&
          r.relationType === 'one-to-many',
      );
      expect(relation).toBeDefined();
    });
  });
});
