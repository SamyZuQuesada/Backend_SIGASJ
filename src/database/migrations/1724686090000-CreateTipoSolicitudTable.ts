import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { TIPOS_SOLICITUD_SEED } from '../../common/enums/tipo-solicitud-slug.enum';

export class CreateTipoSolicitudTable1724686090000 implements MigrationInterface {
  name = 'CreateTipoSolicitudTable1724686090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';
    const boolType = isMssql ? 'bit' : 'boolean';
    const boolTrue = isMssql ? 1 : true;

    if (!(await queryRunner.hasTable('TipoSolicitud'))) {
      await queryRunner.createTable(
        new Table({
          name: 'TipoSolicitud',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'nombre',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'descripcion',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'slug',
              type: 'varchar',
              length: '100',
              isUnique: true,
              isNullable: false,
            },
            {
              name: 'activo',
              type: boolType,
              default: boolTrue,
              isNullable: false,
            },
            {
              name: 'createdAt',
              type: dateTimeType,
              default: defaultDate,
              isNullable: false,
            },
            {
              name: 'updatedAt',
              type: dateTimeType,
              default: defaultDate,
              isNullable: false,
            },
          ],
          indices: [
            new TableIndex({
              name: 'UQ_TipoSolicitud_slug',
              columnNames: ['slug'],
              isUnique: true,
            }),
          ],
        }),
        true,
      );
    }

    // Registrar inicialmente los seis tipos de solicitudes oficiales de forma idempotente
    for (const tipo of TIPOS_SOLICITUD_SEED) {
      const rows = (await queryRunner.query(
        `SELECT id FROM TipoSolicitud WHERE slug = '${tipo.slug}'`,
      )) as Array<{ id: number }>;

      if (!rows || rows.length === 0) {
        const sanitizedNombre = tipo.nombre.replace(/'/g, "''");
        const sanitizedDesc = tipo.descripcion.replace(/'/g, "''");
        const activoVal = isMssql ? '1' : 'true';

        await queryRunner.query(
          `INSERT INTO TipoSolicitud (nombre, descripcion, slug, activo, createdAt, updatedAt)
           VALUES ('${sanitizedNombre}', '${sanitizedDesc}', '${tipo.slug}', ${activoVal}, ${defaultDate}, ${defaultDate})`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('TipoSolicitud')) {
      await queryRunner.dropTable('TipoSolicitud', true);
    }
  }
}
