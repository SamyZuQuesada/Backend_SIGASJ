import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateContactoPublico1724126500000 implements MigrationInterface {
  name = 'CreateContactoPublico1724126500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ContactoPublico',
        columns: [
          {
            name: 'idContactoPublico',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'telefono', type: 'varchar', length: '30' },
          {
            name: 'telefonosAdicionalesJson',
            type: 'nvarchar',
            length: 'max',
            isNullable: true,
          },
          { name: 'email', type: 'varchar', length: '200' },
          { name: 'horarioAtencion', type: 'varchar', length: '300' },
          {
            name: 'horarioVentanilla',
            type: 'varchar',
            length: '300',
            isNullable: true,
          },
          { name: 'direccion', type: 'varchar', length: '500' },
          {
            name: 'referenciaUbicacion',
            type: 'varchar',
            length: '300',
            isNullable: true,
          },
          { name: 'regionResumen', type: 'varchar', length: '200' },
          { name: 'mapaUrl', type: 'varchar', length: '500', isNullable: true },
          {
            name: 'mapaLatitud',
            type: 'decimal',
            precision: 10,
            scale: 7,
            isNullable: true,
          },
          {
            name: 'mapaLongitud',
            type: 'decimal',
            precision: 10,
            scale: 7,
            isNullable: true,
          },
          { name: 'mapaZoom', type: 'int', default: 18 },
          {
            name: 'textoUbicacionMapa',
            type: 'varchar',
            length: '300',
            isNullable: true,
          },
          {
            name: 'urlFacebook',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'descripcionContacto',
            type: 'nvarchar',
            length: 'max',
            isNullable: true,
          },
          { name: 'creadoEn', type: 'datetime2', default: 'GETDATE()' },
          { name: 'actualizadoEn', type: 'datetime2', default: 'GETDATE()' },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ContactoPublico');
  }
}
