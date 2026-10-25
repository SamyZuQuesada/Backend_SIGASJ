import { DataSource } from 'typeorm';
import { AddRequiereFechaVencimientoToMaterial1724686200000 } from './migrations/1724686200000-AddRequiereFechaVencimientoToMaterial';
import { AddPrecioUnitarioYFechaVencimientoToMaterial1724686210000 } from './migrations/1724686210000-AddPrecioUnitarioYFechaVencimientoToMaterial';
import { AddPrecioUnitarioToMovimientoYDetalleReposicion1724686220000 } from './migrations/1724686220000-AddPrecioUnitarioToMovimientoYDetalleReposicion';

describe('Migraciones de precio y vencimiento de inventario', () => {
  it('crea las columnas que faltaban y puede ejecutarse dos veces', async () => {
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
    await queryRunner.query(
      'CREATE TABLE "MovimientoInventario" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL)',
    );
    await queryRunner.query(
      'CREATE TABLE "DetalleReposicionMaterial" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL)',
    );

    const migraciones = [
      new AddRequiereFechaVencimientoToMaterial1724686200000(),
      new AddPrecioUnitarioYFechaVencimientoToMaterial1724686210000(),
      new AddPrecioUnitarioToMovimientoYDetalleReposicion1724686220000(),
    ];

    for (const migracion of migraciones) {
      await migracion.up(queryRunner);
      await migracion.up(queryRunner);
    }

    const material = await queryRunner.getTable('Material');
    expect(material?.findColumnByName('requiereFechaVencimiento')).toBeTruthy();
    expect(material?.findColumnByName('precioUnitario')).toBeTruthy();
    expect(material?.findColumnByName('fechaVencimiento')).toBeTruthy();
    expect(
      (
        await queryRunner.getTable('MovimientoInventario')
      )?.findColumnByName('precioUnitario'),
    ).toBeTruthy();
    expect(
      (
        await queryRunner.getTable('DetalleReposicionMaterial')
      )?.findColumnByName('precioUnitario'),
    ).toBeTruthy();

    for (const migracion of [...migraciones].reverse()) {
      await migracion.down(queryRunner);
    }

    const materialFinal = await queryRunner.getTable('Material');
    expect(
      materialFinal?.findColumnByName('requiereFechaVencimiento'),
    ).toBeFalsy();
    expect(materialFinal?.findColumnByName('precioUnitario')).toBeFalsy();
    expect(materialFinal?.findColumnByName('fechaVencimiento')).toBeFalsy();
    expect(
      (
        await queryRunner.getTable('MovimientoInventario')
      )?.findColumnByName('precioUnitario'),
    ).toBeFalsy();

    await dataSource.destroy();
  });
});
