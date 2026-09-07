import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';
import { TipoActividadFontaneroCodigo } from '../../common/enums/tipo-actividad-fontanero-codigo.enum';

const TIPOS_ACTIVIDAD_SEED: Array<{
  codigo: TipoActividadFontaneroCodigo;
  nombre: string;
  descripcion: string;
}> = [
  {
    codigo: TipoActividadFontaneroCodigo.CONTROL_FUGAS,
    nombre: 'Control de Fugas',
    descripcion: 'Registro de control de fugas en la red de distribución.',
  },
  {
    codigo: TipoActividadFontaneroCodigo.TOMA_PRESION,
    nombre: 'Toma de presión',
    descripcion: 'Medición de presión en puntos operativos de la red.',
  },
  {
    codigo: TipoActividadFontaneroCodigo.VISITA_CAMPO,
    nombre: 'Visita de Campo',
    descripcion: 'Visita operativa en campo para seguimiento o atención.',
  },
  {
    codigo: TipoActividadFontaneroCodigo.CONTROL_CLOROS,
    nombre: 'Control de Cloros',
    descripcion: 'Control de niveles de cloro en el sistema de tratamiento.',
  },
  {
    codigo: TipoActividadFontaneroCodigo.CONTROL_OPERATIVO,
    nombre: 'Control Operativo',
    descripcion: 'Registro de actividades operativas generales.',
  },
  {
    codigo: TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES,
    nombre: 'Incapacidad o vacaciones',
    descripcion: 'Registro de incapacidad o periodo de vacaciones del fontanero.',
  },
];

export class CreateActividadesFontaneroTables1724684200000
  implements MigrationInterface
{
  name = 'CreateActividadesFontaneroTables1724684200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const textType = isMssql ? 'nvarchar(max)' : 'text';
    const dateType = isMssql ? 'date' : 'date';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';
    const boolType = isMssql ? 'bit' : 'boolean';
    const boolTrue = isMssql ? 1 : true;

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
        name: 'TipoActividadFontanero',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'codigo',
            type: 'varchar',
            length: '50',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'nombre',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'descripcion',
            type: textType,
            isNullable: true,
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
      }),
      true,
    );

    for (const tipo of TIPOS_ACTIVIDAD_SEED) {
      await queryRunner.query(
        `INSERT INTO TipoActividadFontanero (codigo, nombre, descripcion, activo)
         VALUES (@0, @1, @2, 1)`,
        [tipo.codigo, tipo.nombre, tipo.descripcion],
      );
    }

    await queryRunner.createTable(
      new Table({
        name: 'ActividadFontanero',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'fontaneroId',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'idUsuario',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'idTipoActividad',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'fechaActividad',
            type: dateType,
            isNullable: true,
          },
          {
            name: 'observaciones',
            type: textType,
            isNullable: true,
          },
          {
            name: 'titulo',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'descripcion',
            type: textType,
            isNullable: true,
          },
          {
            name: 'ubicacion',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'estado',
            type: 'varchar',
            length: '40',
            default: "'REPORTADA'",
            isNullable: false,
          },
          {
            name: 'observacionCorreccion',
            type: textType,
            isNullable: true,
          },
          {
            name: 'revisadoPorId',
            type: 'varchar',
            length: '100',
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
      'ActividadFontanero',
      new TableForeignKey({
        name: 'FK_ActividadFontanero_TipoActividadFontanero',
        columnNames: ['idTipoActividad'],
        referencedTableName: 'TipoActividadFontanero',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createForeignKey(
      'ActividadFontanero',
      new TableForeignKey({
        name: 'FK_ActividadFontanero_Usuario',
        columnNames: ['idUsuario'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'ActividadFontanero',
      'FK_ActividadFontanero_Usuario',
    );
    await queryRunner.dropForeignKey(
      'ActividadFontanero',
      'FK_ActividadFontanero_TipoActividadFontanero',
    );
    await queryRunner.dropTable('ActividadFontanero');
    await queryRunner.dropTable('TipoActividadFontanero');
  }
}
