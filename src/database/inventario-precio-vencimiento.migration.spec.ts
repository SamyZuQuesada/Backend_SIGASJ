import { DataSource } from 'typeorm';
import { AddRequiereFechaVencimientoToMaterial1724686360000 } from './migrations/1724686360000-AddRequiereFechaVencimientoToMaterial';

describe('Migración requiereFechaVencimiento', () => {
  it('crea la columna, se puede repetir y se revierte', async () => {
    const dataSource = new DataSource({
      type: 'sqljs',
      entities: [],
      synchronize: false,
    });
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.query(
      'CREATE TABLE "Material" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL)',
    );

    const migracion = new AddRequiereFechaVencimientoToMaterial1724686360000();
    await migracion.up(queryRunner);
    await migracion.up(queryRunner);

    const material = await queryRunner.getTable('Material');
    expect(material?.findColumnByName('requiereFechaVencimiento')).toBeTruthy();

    await migracion.down(queryRunner);
    const materialFinal = await queryRunner.getTable('Material');
    expect(
      materialFinal?.findColumnByName('requiereFechaVencimiento'),
    ).toBeFalsy();

    await dataSource.destroy();
  });
});
