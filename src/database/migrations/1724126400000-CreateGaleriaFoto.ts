import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateGaleriaFoto1724126400000 implements MigrationInterface {
  name = 'CreateGaleriaFoto1724126400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'GaleriaFoto',
        columns: [
          {
            name: 'idGaleriaFoto',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'titulo',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'descripcion',
            type: 'nvarchar',
            length: 'max',
            isNullable: true,
          },
          {
            name: 'imagenUrl',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'textoAlternativo',
            type: 'varchar',
            length: '300',
          },
          {
            name: 'ordenVisualizacion',
            type: 'int',
            default: 0,
          },
          {
            name: 'activo',
            type: 'bit',
            default: 1,
          },
          {
            name: 'creadoEn',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'actualizadoEn',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('GaleriaFoto');
  }
}
