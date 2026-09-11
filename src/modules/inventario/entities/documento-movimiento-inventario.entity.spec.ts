import { getMetadataArgsStorage } from 'typeorm';
import { DocumentoMovimientoInventario } from './documento-movimiento-inventario.entity';
import { MovimientoInventario } from './movimiento-inventario.entity';

describe('DocumentoMovimientoInventario Entity', () => {
  describe('1. Instanciación y Asignación de Campos', () => {
    it('debe existir la clase DocumentoMovimientoInventario', () => {
      expect(DocumentoMovimientoInventario).toBeDefined();
    });

    it('debe permitir instanciar y asignar todos los campos del documento de respaldo', () => {
      const doc = new DocumentoMovimientoInventario();
      const now = new Date();

      const mov = new MovimientoInventario();
      mov.id = 105;

      doc.id = 1;
      doc.nombreOriginal = 'factura_compra_tubos_2026.pdf';
      doc.tipoArchivo = 'application/pdf';
      doc.rutaReferenciaArchivo =
        '/api/v1/inventario/movimientos/105/documentos/1724685000000-uuid.pdf';
      doc.tamanio = 1024 * 500; // 500 KB
      doc.idMovimiento = 105;
      doc.movimiento = mov;
      doc.createdAt = now;
      doc.updatedAt = now;

      expect(doc.id).toBe(1);
      expect(doc.nombreOriginal).toBe('factura_compra_tubos_2026.pdf');
      expect(doc.tipoArchivo).toBe('application/pdf');
      expect(doc.rutaReferenciaArchivo).toContain('105/documentos');
      expect(doc.tamanio).toBe(512000);
      expect(doc.idMovimiento).toBe(105);
      expect(doc.movimiento).toBe(mov);
      expect(doc.createdAt).toEqual(now);
      expect(doc.updatedAt).toEqual(now);
    });
  });

  describe('2. Metadatos de TypeORM', () => {
    const storage = getMetadataArgsStorage();

    it('debe estar registrada como entidad con la tabla "DocumentoMovimientoInventario"', () => {
      const table = storage.tables.find(
        (t) =>
          t.target === DocumentoMovimientoInventario ||
          t.name === 'DocumentoMovimientoInventario',
      );
      expect(table).toBeDefined();
      expect(table?.name).toBe('DocumentoMovimientoInventario');
    });

    it('debe contener las columnas requeridas para auditoría y archivo', () => {
      const columns = storage.columns
        .filter((c) => c.target === DocumentoMovimientoInventario)
        .map((c) => c.propertyName);

      expect(columns).toContain('id');
      expect(columns).toContain('nombreOriginal');
      expect(columns).toContain('tipoArchivo');
      expect(columns).toContain('rutaReferenciaArchivo');
      expect(columns).toContain('tamanio');
      expect(columns).toContain('idMovimiento');
      expect(columns).toContain('createdAt');
      expect(columns).toContain('updatedAt');
    });

    it('debe configurar relación ManyToOne con MovimientoInventario y ON DELETE CASCADE', () => {
      const relation = storage.relations.find(
        (r) =>
          r.target === DocumentoMovimientoInventario &&
          r.propertyName === 'movimiento' &&
          r.relationType === 'many-to-one',
      );
      expect(relation).toBeDefined();
      expect(relation?.options?.nullable).toBe(false);
      expect(relation?.options?.onDelete).toBe('CASCADE');

      const joinCol = storage.joinColumns.find(
        (jc) =>
          jc.target === DocumentoMovimientoInventario &&
          jc.propertyName === 'movimiento',
      );
      expect(joinCol).toBeDefined();
      expect(joinCol?.name).toBe('idMovimiento');
    });

    it('debe configurar la relación inversa OneToMany en MovimientoInventario', () => {
      const relation = storage.relations.find(
        (r) =>
          r.target === MovimientoInventario &&
          r.propertyName === 'documentos' &&
          r.relationType === 'one-to-many',
      );
      expect(relation).toBeDefined();
    });
  });
});
