import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateAveriaTable1724685100000 implements MigrationInterface {
  name = 'CreateAveriaTable1724685100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const textType = isMssql ? 'nvarchar(max)' : 'text';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    if (!(await queryRunner.hasTable('Usuario'))) {
      if (isMssql) {
        await queryRunner.query(`
          CREATE TABLE Usuario (
            idUsuario INT IDENTITY(1,1) NOT NULL PRIMARY KEY
          )
        `);
      } else {
        await queryRunner.query(`
          CREATE TABLE Usuario (
            idUsuario INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL
          )
        `);
      }
    }

    await queryRunner.createTable(
      new Table({
        name: 'Averia',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'codigoSeguimiento',
            type: 'varchar',
            length: '40',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'fechaReporte',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
          {
            name: 'nombreReportante',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'identificacionReportante',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'telefonoReportante',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'correoReportante',
            type: 'varchar',
            length: '150',
            isNullable: true,
          },
          {
            name: 'idAbonado',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'ubicacion',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'sectorComunidad',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'descripcion',
            type: textType,
            isNullable: false,
          },
          {
            name: 'estado',
            type: 'varchar',
            length: '40',
            default: "'RECIBIDA'",
            isNullable: false,
          },
          {
            name: 'tipoAveria',
            type: 'varchar',
            length: '80',
            isNullable: true,
          },
          {
            name: 'prioridad',
            type: 'varchar',
            length: '40',
            isNullable: true,
          },
          {
            name: 'idFontaneroAsignado',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'fechaAsignacion',
            type: dateTimeType,
            isNullable: true,
          },
          {
            name: 'fechaInicioAtencion',
            type: dateTimeType,
            isNullable: true,
          },
          {
            name: 'fechaResolucion',
            type: dateTimeType,
            isNullable: true,
          },
          {
            name: 'observacionesAtencion',
            type: textType,
            isNullable: true,
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
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'Averia',
      new TableForeignKey({
        name: 'FK_Averia_Usuario_FontaneroAsignado',
        columnNames: ['idFontaneroAsignado'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'SET NULL',
        onUpdate: 'NO ACTION',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('Averia');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.name === 'FK_Averia_Usuario_FontaneroAsignado',
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('Averia', foreignKey);
    }
    await queryRunner.dropTable('Averia', true);
  }
}
