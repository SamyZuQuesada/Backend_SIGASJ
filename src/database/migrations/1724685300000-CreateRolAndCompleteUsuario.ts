import { randomUUID } from 'node:crypto';
import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { ROLES_SISTEMA } from '../../common/enums/role.enum';
import { hashPassword } from '../../modules/auth/password.util';

export class CreateRolAndCompleteUsuario1724685300000 implements MigrationInterface {
  name = 'CreateRolAndCompleteUsuario1724685300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const boolType = isMssql ? 'bit' : 'boolean';
    const boolTrue = isMssql ? 1 : true;
    const boolFalse = isMssql ? 0 : false;

    if (!(await queryRunner.hasTable('Rol'))) {
      await queryRunner.createTable(
        new Table({
          name: 'Rol',
          columns: [
            {
              name: 'idRol',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'nombre',
              type: 'varchar',
              length: '40',
              isNullable: false,
              isUnique: true,
            },
          ],
        }),
      );
    }

    for (const nombre of ROLES_SISTEMA) {
      const existentes = this.asIdRows(
        await queryRunner.query(
          `SELECT idRol FROM Rol WHERE nombre = '${nombre}'`,
        ),
      );
      if (!existentes.length) {
        await queryRunner.query(
          `INSERT INTO Rol (nombre) VALUES ('${nombre}')`,
        );
      }
    }

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

    await this.addColumnIfMissing(queryRunner, 'Usuario', {
      name: 'nombre',
      type: 'varchar',
      length: '150',
      isNullable: true,
    });
    await this.addColumnIfMissing(queryRunner, 'Usuario', {
      name: 'correo',
      type: 'varchar',
      length: '150',
      isNullable: true,
    });
    await this.addColumnIfMissing(queryRunner, 'Usuario', {
      name: 'passwordHash',
      type: 'varchar',
      length: '255',
      isNullable: true,
    });
    await this.addColumnIfMissing(queryRunner, 'Usuario', {
      name: 'activo',
      type: boolType,
      isNullable: true,
    });
    await this.addColumnIfMissing(queryRunner, 'Usuario', {
      name: 'idRol',
      type: 'int',
      isNullable: true,
    });

    const abonado = this.asIdRows(
      await queryRunner.query(`SELECT idRol FROM Rol WHERE nombre = 'ABONADO'`),
    );
    const idRolAbonado = abonado[0]?.idRol;
    const orphanHash = await hashPassword(randomUUID());

    await queryRunner.query(
      `UPDATE Usuario SET nombre = 'Usuario pendiente' WHERE nombre IS NULL`,
    );
    if (isMssql) {
      await queryRunner.query(
        `UPDATE Usuario SET correo = CONCAT('usuario', idUsuario, '@pendiente.local') WHERE correo IS NULL`,
      );
    } else {
      await queryRunner.query(
        `UPDATE Usuario SET correo = 'usuario' || idUsuario || '@pendiente.local' WHERE correo IS NULL`,
      );
    }
    await queryRunner.query(
      `UPDATE Usuario SET passwordHash = '${orphanHash}' WHERE passwordHash IS NULL`,
    );
    await queryRunner.query(
      `UPDATE Usuario SET activo = ${boolFalse} WHERE activo IS NULL`,
    );
    if (idRolAbonado != null) {
      await queryRunner.query(
        `UPDATE Usuario SET idRol = ${idRolAbonado} WHERE idRol IS NULL`,
      );
    }

    await queryRunner.changeColumn(
      'Usuario',
      'nombre',
      new TableColumn({
        name: 'nombre',
        type: 'varchar',
        length: '150',
        isNullable: false,
      }),
    );
    await queryRunner.changeColumn(
      'Usuario',
      'correo',
      new TableColumn({
        name: 'correo',
        type: 'varchar',
        length: '150',
        isNullable: false,
      }),
    );
    await queryRunner.changeColumn(
      'Usuario',
      'passwordHash',
      new TableColumn({
        name: 'passwordHash',
        type: 'varchar',
        length: '255',
        isNullable: false,
      }),
    );
    await queryRunner.changeColumn(
      'Usuario',
      'activo',
      new TableColumn({
        name: 'activo',
        type: boolType,
        default: boolTrue,
        isNullable: false,
      }),
    );
    await queryRunner.changeColumn(
      'Usuario',
      'idRol',
      new TableColumn({
        name: 'idRol',
        type: 'int',
        isNullable: false,
      }),
    );

    const correoIndexes = await queryRunner.getTable('Usuario');
    const hasCorreoUnique = correoIndexes?.indices.some((index) =>
      index.columnNames.includes('correo'),
    );
    if (!hasCorreoUnique) {
      await queryRunner.createIndex(
        'Usuario',
        new TableIndex({
          name: 'UQ_Usuario_correo',
          columnNames: ['correo'],
          isUnique: true,
        }),
      );
    }

    const table = await queryRunner.getTable('Usuario');
    const hasFk = table?.foreignKeys.some(
      (fk) => fk.columnNames.length === 1 && fk.columnNames[0] === 'idRol',
    );
    if (!hasFk) {
      await queryRunner.createForeignKey(
        'Usuario',
        new TableForeignKey({
          name: 'FK_Usuario_Rol_idRol',
          columnNames: ['idRol'],
          referencedTableName: 'Rol',
          referencedColumnNames: ['idRol'],
          onDelete: 'NO ACTION',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('Usuario');
    const fk = table?.foreignKeys.find(
      (item) =>
        item.columnNames.length === 1 && item.columnNames[0] === 'idRol',
    );
    if (fk) {
      await queryRunner.dropForeignKey('Usuario', fk);
    }
    const correoIndex = table?.indices.find((index) =>
      index.columnNames.includes('correo'),
    );
    if (correoIndex) {
      await queryRunner.dropIndex('Usuario', correoIndex);
    }

    for (const column of [
      'idRol',
      'activo',
      'passwordHash',
      'correo',
      'nombre',
    ]) {
      if (await queryRunner.hasColumn('Usuario', column)) {
        await queryRunner.dropColumn('Usuario', column);
      }
    }

    if (await queryRunner.hasTable('Rol')) {
      await queryRunner.dropTable('Rol');
    }
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    table: string,
    options: ConstructorParameters<typeof TableColumn>[0],
  ): Promise<void> {
    const column = new TableColumn(options);
    if (await queryRunner.hasColumn(table, column.name)) {
      return;
    }
    await queryRunner.addColumn(table, column);
  }

  private asIdRows(value: unknown): Array<{ idRol: number }> {
    if (!Array.isArray(value)) {
      return [];
    }
    const rows: Array<{ idRol: number }> = [];
    for (const item of value) {
      const row: unknown = item;
      if (typeof row !== 'object' || row === null) {
        continue;
      }
      const idRol: unknown = (row as { idRol?: unknown }).idRol;
      if (typeof idRol === 'number') {
        rows.push({ idRol });
      }
    }
    return rows;
  }
}
