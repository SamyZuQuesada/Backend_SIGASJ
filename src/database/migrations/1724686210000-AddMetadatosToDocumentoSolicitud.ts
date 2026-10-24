import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddMetadatosToDocumentoSolicitud1724686210000
  implements MigrationInterface
{
  name = 'AddMetadatosToDocumentoSolicitud1724686210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('DocumentoSolicitud'))) {
      return;
    }

    if (!(await queryRunner.hasColumn('DocumentoSolicitud', 'nombreInterno'))) {
      await queryRunner.addColumn(
        'DocumentoSolicitud',
        new TableColumn({
          name: 'nombreInterno',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('DocumentoSolicitud', 'mimeType'))) {
      await queryRunner.addColumn(
        'DocumentoSolicitud',
        new TableColumn({
          name: 'mimeType',
          type: 'varchar',
          length: '100',
          isNullable: true,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('DocumentoSolicitud', 'tamano'))) {
      await queryRunner.addColumn(
        'DocumentoSolicitud',
        new TableColumn({
          name: 'tamano',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('DocumentoSolicitud', 'ubicacion'))) {
      await queryRunner.addColumn(
        'DocumentoSolicitud',
        new TableColumn({
          name: 'ubicacion',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }),
      );
    }

    // Backfill de datos existentes para consistencia
    const hasTipoArchivo = await queryRunner.hasColumn(
      'DocumentoSolicitud',
      'tipoArchivo',
    );
    const hasTamanio = await queryRunner.hasColumn(
      'DocumentoSolicitud',
      'tamanio',
    );
    const hasRuta = await queryRunner.hasColumn(
      'DocumentoSolicitud',
      'rutaReferenciaArchivo',
    );

    if (hasTipoArchivo) {
      await queryRunner.query(
        `UPDATE "DocumentoSolicitud" SET "mimeType" = "tipoArchivo" WHERE "mimeType" IS NULL AND "tipoArchivo" IS NOT NULL`,
      );
    }

    if (hasTamanio) {
      await queryRunner.query(
        `UPDATE "DocumentoSolicitud" SET "tamano" = "tamanio" WHERE "tamano" IS NULL AND "tamanio" IS NOT NULL`,
      );
    }

    if (hasRuta) {
      await queryRunner.query(
        `UPDATE "DocumentoSolicitud" SET "ubicacion" = "rutaReferenciaArchivo" WHERE "ubicacion" IS NULL AND "rutaReferenciaArchivo" IS NOT NULL`,
      );

      const isMssql = queryRunner.connection.options.type === 'mssql';
      if (isMssql) {
        await queryRunner.query(`
          UPDATE "DocumentoSolicitud"
          SET "nombreInterno" = RIGHT("rutaReferenciaArchivo", CHARINDEX('/', REVERSE('/' + "rutaReferenciaArchivo")) - 1)
          WHERE "nombreInterno" IS NULL AND "rutaReferenciaArchivo" IS NOT NULL
        `);
      } else {
        await queryRunner.query(`
          UPDATE "DocumentoSolicitud"
          SET "nombreInterno" = "rutaReferenciaArchivo"
          WHERE "nombreInterno" IS NULL AND "rutaReferenciaArchivo" IS NOT NULL
        `);
      }
    }

    const table = await queryRunner.getTable('DocumentoSolicitud');
    const hasIndexNombreInterno = table?.indices.some(
      (idx) => idx.name === 'IX_DocumentoSolicitud_nombreInterno',
    );
    if (!hasIndexNombreInterno) {
      await queryRunner.createIndex(
        'DocumentoSolicitud',
        new TableIndex({
          name: 'IX_DocumentoSolicitud_nombreInterno',
          columnNames: ['nombreInterno'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('DocumentoSolicitud'))) {
      return;
    }

    const table = await queryRunner.getTable('DocumentoSolicitud');
    const hasIndexNombreInterno = table?.indices.some(
      (idx) => idx.name === 'IX_DocumentoSolicitud_nombreInterno',
    );
    if (hasIndexNombreInterno) {
      await queryRunner.dropIndex(
        'DocumentoSolicitud',
        'IX_DocumentoSolicitud_nombreInterno',
      );
    }

    if (await queryRunner.hasColumn('DocumentoSolicitud', 'ubicacion')) {
      await queryRunner.dropColumn('DocumentoSolicitud', 'ubicacion');
    }
    if (await queryRunner.hasColumn('DocumentoSolicitud', 'tamano')) {
      await queryRunner.dropColumn('DocumentoSolicitud', 'tamano');
    }
    if (await queryRunner.hasColumn('DocumentoSolicitud', 'mimeType')) {
      await queryRunner.dropColumn('DocumentoSolicitud', 'mimeType');
    }
    if (await queryRunner.hasColumn('DocumentoSolicitud', 'nombreInterno')) {
      await queryRunner.dropColumn('DocumentoSolicitud', 'nombreInterno');
    }
  }
}
