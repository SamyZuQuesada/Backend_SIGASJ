import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Épica 6.5: solicitudes de permiso/vacaciones del Fontanero vía Jotform.
 * SolicitudAusencia (PENDIENTE → APROBADA/RECHAZADA) + token de correlación.
 */
export class CreateSolicitudAusenciaTables1724686040000 implements MigrationInterface {
  name = 'CreateSolicitudAusenciaTables1724686040000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const intType = isMssql ? 'int' : 'integer';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    if (!(await queryRunner.hasTable('CorrelacionSolicitudAusencia'))) {
      await queryRunner.createTable(
        new Table({
          name: 'CorrelacionSolicitudAusencia',
          columns: [
            {
              name: 'id',
              type: intType,
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'token',
              type: 'varchar',
              length: '64',
              isNullable: false,
            },
            {
              name: 'colaboradorId',
              type: intType,
              isNullable: false,
            },
            {
              name: 'usuarioId',
              type: intType,
              isNullable: false,
            },
            {
              name: 'expiresAt',
              type: dateTimeType,
              isNullable: false,
            },
            {
              name: 'usedAt',
              type: dateTimeType,
              isNullable: true,
            },
            {
              name: 'jotformSubmissionId',
              type: 'varchar',
              length: '64',
              isNullable: true,
            },
            {
              name: 'createdAt',
              type: dateTimeType,
              default: defaultDate,
              isNullable: false,
            },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'CorrelacionSolicitudAusencia',
        new TableIndex({
          name: 'UQ_CorrelacionSolicitudAusencia_token',
          columnNames: ['token'],
          isUnique: true,
        }),
      );
    }

    if (!(await queryRunner.hasTable('SolicitudAusencia'))) {
      await queryRunner.createTable(
        new Table({
          name: 'SolicitudAusencia',
          columns: [
            {
              name: 'id',
              type: intType,
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'colaboradorId',
              type: intType,
              isNullable: false,
            },
            {
              name: 'tipo',
              type: 'varchar',
              length: '20',
              isNullable: false,
            },
            {
              name: 'fechaInicio',
              type: 'date',
              isNullable: false,
            },
            {
              name: 'fechaFin',
              type: 'date',
              isNullable: false,
            },
            {
              name: 'motivo',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'observaciones',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'estado',
              type: 'varchar',
              length: '20',
              isNullable: false,
              default: "'PENDIENTE'",
            },
            {
              name: 'jotformSubmissionId',
              type: 'varchar',
              length: '64',
              isNullable: false,
            },
            {
              name: 'reviewedAt',
              type: dateTimeType,
              isNullable: true,
            },
            {
              name: 'reviewedByUsuarioId',
              type: intType,
              isNullable: true,
            },
            {
              name: 'motivoRechazo',
              type: 'varchar',
              length: '500',
              isNullable: true,
            },
            {
              name: 'registroGeneradoId',
              type: intType,
              isNullable: true,
            },
            {
              name: 'registroGeneradoTipo',
              type: 'varchar',
              length: '40',
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
          checks: [
            {
              name: 'CK_SolicitudAusencia_Tipo',
              expression: "tipo IN ('PERMISO', 'VACACIONES')",
            },
            {
              name: 'CK_SolicitudAusencia_Estado',
              expression: "estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')",
            },
          ],
        }),
        true,
      );

      await queryRunner.createIndex(
        'SolicitudAusencia',
        new TableIndex({
          name: 'UQ_SolicitudAusencia_jotformSubmissionId',
          columnNames: ['jotformSubmissionId'],
          isUnique: true,
        }),
      );

      await queryRunner.createIndex(
        'SolicitudAusencia',
        new TableIndex({
          name: 'IX_SolicitudAusencia_colaboradorId',
          columnNames: ['colaboradorId'],
        }),
      );

      await queryRunner.createIndex(
        'SolicitudAusencia',
        new TableIndex({
          name: 'IX_SolicitudAusencia_estado',
          columnNames: ['estado'],
        }),
      );

      await queryRunner.createForeignKey(
        'SolicitudAusencia',
        new TableForeignKey({
          name: 'FK_SolicitudAusencia_Colaborador',
          columnNames: ['colaboradorId'],
          referencedTableName: 'Colaborador',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
          onUpdate: 'NO ACTION',
        }),
      );

      await queryRunner.createForeignKey(
        'SolicitudAusencia',
        new TableForeignKey({
          name: 'FK_SolicitudAusencia_UsuarioRevisor',
          columnNames: ['reviewedByUsuarioId'],
          referencedTableName: 'Usuario',
          referencedColumnNames: ['idUsuario'],
          onDelete: 'SET NULL',
          onUpdate: 'NO ACTION',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('SolicitudAusencia')) {
      const table = await queryRunner.getTable('SolicitudAusencia');
      for (const fkName of [
        'FK_SolicitudAusencia_UsuarioRevisor',
        'FK_SolicitudAusencia_Colaborador',
      ]) {
        const fk = table?.foreignKeys.find((f) => f.name === fkName);
        if (fk) {
          await queryRunner.dropForeignKey('SolicitudAusencia', fk);
        }
      }
      await queryRunner.dropTable('SolicitudAusencia');
    }
    if (await queryRunner.hasTable('CorrelacionSolicitudAusencia')) {
      await queryRunner.dropTable('CorrelacionSolicitudAusencia');
    }
  }
}
