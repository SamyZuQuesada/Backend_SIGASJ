import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Políticas RRHH ASADA: Puesto, AJUSTE/auditoría vacaciones,
 * origen incapacidad.
 */
export class RrhhPoliticasAsada1724686050000 implements MigrationInterface {
  name = 'RrhhPoliticasAsada1724686050000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const intType = isMssql ? 'int' : 'integer';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';
    const boolType = isMssql ? 'bit' : 'boolean';

    if (!(await queryRunner.hasTable('Puesto'))) {
      await queryRunner.createTable(
        new Table({
          name: 'Puesto',
          columns: [
            {
              name: 'id',
              type: intType,
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'nombre',
              type: 'varchar',
              length: '100',
              isNullable: false,
            },
            {
              name: 'critico',
              type: boolType,
              default: isMssql ? '0' : 'false',
              isNullable: false,
            },
            {
              name: 'activo',
              type: boolType,
              default: isMssql ? '1' : 'true',
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
      await queryRunner.createIndex(
        'Puesto',
        new TableIndex({
          name: 'UQ_Puesto_nombre',
          columnNames: ['nombre'],
          isUnique: true,
        }),
      );

      // Seed mínimo de nombres; critico=false hasta que ASADA configure cobertura.
      for (const nombre of [
        'Fontanero',
        'Administración',
        'Secretaría',
        'Operación',
        'Atención al usuario',
        'Personal técnico',
      ]) {
        await queryRunner.query(
          `INSERT INTO "Puesto" ("nombre", "critico", "activo") VALUES ('${nombre}', ${isMssql ? '0' : 'false'}, ${isMssql ? '1' : 'true'})`,
        );
      }
    }

    if (await queryRunner.hasTable('ConfiguracionRrhh')) {
      await queryRunner.dropTable('ConfiguracionRrhh');
    }

    const colaborador = await queryRunner.getTable('Colaborador');
    if (colaborador && !colaborador.findColumnByName('puestoId')) {
      await queryRunner.addColumn(
        'Colaborador',
        new TableColumn({
          name: 'puestoId',
          type: intType,
          isNullable: true,
        }),
      );
      await queryRunner.createForeignKey(
        'Colaborador',
        new TableForeignKey({
          name: 'FK_Colaborador_Puesto',
          columnNames: ['puestoId'],
          referencedTableName: 'Puesto',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          onUpdate: 'NO ACTION',
        }),
      );
      // Backfill por nombre de cargo (portable MSSQL / SQLite de tests)
      if (isMssql) {
        await queryRunner.query(`
          UPDATE c SET c."puestoId" = p."id"
          FROM "Colaborador" c
          INNER JOIN "Puesto" p ON LOWER(LTRIM(RTRIM(c."cargo"))) = LOWER(p."nombre")
          WHERE c."puestoId" IS NULL
        `);
      } else {
        await queryRunner.query(`
          UPDATE "Colaborador"
          SET "puestoId" = (
            SELECT p."id" FROM "Puesto" p
            WHERE LOWER(TRIM(p."nombre")) = LOWER(TRIM("Colaborador"."cargo"))
            LIMIT 1
          )
          WHERE "puestoId" IS NULL
        `);
      }
    }

    const movimiento = await queryRunner.getTable('MovimientoVacaciones');
    if (movimiento) {
      if (!movimiento.findColumnByName('registradoPorUsuarioId')) {
        await queryRunner.addColumn(
          'MovimientoVacaciones',
          new TableColumn({
            name: 'registradoPorUsuarioId',
            type: intType,
            isNullable: true,
          }),
        );
      }
      if (!movimiento.findColumnByName('signoAjuste')) {
        await queryRunner.addColumn(
          'MovimientoVacaciones',
          new TableColumn({
            name: 'signoAjuste',
            type: intType,
            isNullable: true,
          }),
        );
      }
      // Ampliar CHECK de tipo (drop + create si existe)
      const tipoCheck = movimiento.checks?.find((c) =>
        /tipo/i.test(c.name ?? ''),
      );
      if (tipoCheck?.name) {
        await queryRunner.query(
          `ALTER TABLE "MovimientoVacaciones" DROP CONSTRAINT "${tipoCheck.name}"`,
        );
      }
      await queryRunner.query(`
        ALTER TABLE "MovimientoVacaciones"
        ADD CONSTRAINT "CK_MovimientoVacaciones_Tipo"
        CHECK (tipo IN ('ACUMULADO', 'DISFRUTADO', 'AJUSTE'))
      `);
      await queryRunner.query(`
        ALTER TABLE "MovimientoVacaciones"
        ADD CONSTRAINT "CK_MovimientoVacaciones_SignoAjuste"
        CHECK (
          (tipo = 'AJUSTE' AND signoAjuste IN (1, -1))
          OR (tipo <> 'AJUSTE' AND signoAjuste IS NULL)
        )
      `);
    }

    const incapacidad = await queryRunner.getTable('Incapacidad');
    if (incapacidad && !incapacidad.findColumnByName('origen')) {
      await queryRunner.addColumn(
        'Incapacidad',
        new TableColumn({
          name: 'origen',
          type: 'varchar',
          length: '20',
          isNullable: true,
        }),
      );
      await queryRunner.query(`
        ALTER TABLE "Incapacidad"
        ADD CONSTRAINT "CK_Incapacidad_Origen"
        CHECK (origen IS NULL OR origen IN ('CCSS', 'INS', 'OTRO'))
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const incapacidad = await queryRunner.getTable('Incapacidad');
    if (incapacidad?.findColumnByName('origen')) {
      try {
        await queryRunner.query(
          `ALTER TABLE "Incapacidad" DROP CONSTRAINT "CK_Incapacidad_Origen"`,
        );
      } catch {
        /* ignore */
      }
      await queryRunner.dropColumn('Incapacidad', 'origen');
    }

    const movimiento = await queryRunner.getTable('MovimientoVacaciones');
    if (movimiento) {
      for (const name of [
        'CK_MovimientoVacaciones_SignoAjuste',
        'CK_MovimientoVacaciones_Tipo',
      ]) {
        try {
          await queryRunner.query(
            `ALTER TABLE "MovimientoVacaciones" DROP CONSTRAINT "${name}"`,
          );
        } catch {
          /* ignore */
        }
      }
      if (movimiento.findColumnByName('signoAjuste')) {
        await queryRunner.dropColumn('MovimientoVacaciones', 'signoAjuste');
      }
      if (movimiento.findColumnByName('registradoPorUsuarioId')) {
        await queryRunner.dropColumn(
          'MovimientoVacaciones',
          'registradoPorUsuarioId',
        );
      }
      await queryRunner.query(`
        ALTER TABLE "MovimientoVacaciones"
        ADD CONSTRAINT "CK_MovimientoVacaciones_Tipo"
        CHECK (tipo IN ('ACUMULADO', 'DISFRUTADO'))
      `);
    }

    const colaborador = await queryRunner.getTable('Colaborador');
    if (colaborador?.findColumnByName('puestoId')) {
      const fk = colaborador.foreignKeys.find(
        (f) => f.name === 'FK_Colaborador_Puesto',
      );
      if (fk) await queryRunner.dropForeignKey('Colaborador', fk);
      await queryRunner.dropColumn('Colaborador', 'puestoId');
    }

    if (await queryRunner.hasTable('Puesto')) {
      await queryRunner.dropTable('Puesto');
    }
  }
}
