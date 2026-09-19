import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Horario habitual de trabajo por Fontanero y día de la semana.
 * No modela vacaciones, incapacidades, feriados ni guardias.
 */
export class CreateHorarioLaboralFontaneroTable1724685800000 implements MigrationInterface {
  name = 'CreateHorarioLaboralFontaneroTable1724685800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('HorarioLaboralFontanero')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const boolType = isMssql ? 'bit' : 'boolean';
    const boolTrue = isMssql ? 1 : true;
    const dayType = isMssql ? 'tinyint' : 'integer';

    await queryRunner.createTable(
      new Table({
        name: 'HorarioLaboralFontanero',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'idFontanero',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'diaSemana',
            type: dayType,
            isNullable: false,
          },
          {
            name: 'horaInicio',
            type: 'time',
            isNullable: false,
          },
          {
            name: 'horaFin',
            type: 'time',
            isNullable: false,
          },
          {
            name: 'activo',
            type: boolType,
            default: boolTrue,
            isNullable: false,
          },
        ],
        checks: [
          {
            name: 'CK_HorarioLaboralFontanero_DiaSemana',
            expression: 'diaSemana >= 1 AND diaSemana <= 7',
          },
          {
            name: 'CK_HorarioLaboralFontanero_Horas',
            expression: 'horaInicio < horaFin',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'HorarioLaboralFontanero',
      new TableForeignKey({
        name: 'FK_HorarioLaboralFontanero_Usuario',
        columnNames: ['idFontanero'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'HorarioLaboralFontanero',
      new TableIndex({
        name: 'UQ_HorarioLaboralFontanero_Fontanero_Dia',
        columnNames: ['idFontanero', 'diaSemana'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'HorarioLaboralFontanero',
      new TableIndex({
        name: 'IX_HorarioLaboralFontanero_Fontanero_Dia_Activo',
        columnNames: ['idFontanero', 'diaSemana', 'activo'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('HorarioLaboralFontanero');
    if (!table) {
      return;
    }

    const fontaneroFk = table.foreignKeys.find(
      (fk) => fk.name === 'FK_HorarioLaboralFontanero_Usuario',
    );
    if (fontaneroFk) {
      await queryRunner.dropForeignKey('HorarioLaboralFontanero', fontaneroFk);
    }

    const uniqueIndex = table.indices.find(
      (index) => index.name === 'UQ_HorarioLaboralFontanero_Fontanero_Dia',
    );
    if (uniqueIndex) {
      await queryRunner.dropIndex('HorarioLaboralFontanero', uniqueIndex);
    }

    const queryIndex = table.indices.find(
      (index) =>
        index.name === 'IX_HorarioLaboralFontanero_Fontanero_Dia_Activo',
    );
    if (queryIndex) {
      await queryRunner.dropIndex('HorarioLaboralFontanero', queryIndex);
    }

    await queryRunner.dropTable('HorarioLaboralFontanero', true);
  }
}
