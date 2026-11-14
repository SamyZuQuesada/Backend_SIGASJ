import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bytes de fotos y PDF. El disco de Render se borra en cada publicación;
 * la ruta pública sigue en las tablas de negocio y el contenido vive aquí.
 */
export class CreateArchivoMediaTable1724686400000
  implements MigrationInterface
{
  name = 'CreateArchivoMediaTable1724686400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'mssql') {
      return;
    }
    if (await queryRunner.hasTable('ArchivoMedia')) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE dbo.ArchivoMedia (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ruta VARCHAR(500) NOT NULL,
        mime VARCHAR(120) NOT NULL,
        contenido VARBINARY(MAX) NOT NULL,
        CONSTRAINT UQ_ArchivoMedia_ruta UNIQUE (ruta)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'mssql') {
      return;
    }
    if (await queryRunner.hasTable('ArchivoMedia')) {
      await queryRunner.dropTable('ArchivoMedia');
    }
  }
}
