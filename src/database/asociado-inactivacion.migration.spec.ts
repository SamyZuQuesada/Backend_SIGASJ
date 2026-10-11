import { QueryRunner, TableColumn } from 'typeorm';
import { AddMotivoInactivacionToAsociado1724685970000 } from './migrations/1724685970000-AddMotivoInactivacionToAsociado';

describe('Migración AddMotivoInactivacionToAsociado (PBI 5.4.3)', () => {
  const crearQueryRunner = (tieneColumna: boolean) => {
    const addColumn = jest.fn().mockResolvedValue(undefined);
    const dropColumn = jest.fn().mockResolvedValue(undefined);
    const hasColumn = jest.fn().mockResolvedValue(tieneColumna);
    const queryRunner = {
      addColumn,
      dropColumn,
      hasColumn,
    } as unknown as QueryRunner;
    return { queryRunner, addColumn, dropColumn, hasColumn };
  };

  it('está bien nombrada', () => {
    expect(new AddMotivoInactivacionToAsociado1724685970000().name).toBe(
      'AddMotivoInactivacionToAsociado1724685970000',
    );
  });

  it('agrega motivoInactivacion varchar(500) nulable a Asociado', async () => {
    const { queryRunner, addColumn } = crearQueryRunner(false);
    await new AddMotivoInactivacionToAsociado1724685970000().up(queryRunner);

    expect(addColumn).toHaveBeenCalledTimes(1);
    const [tabla, columna] = addColumn.mock.calls[0] as [string, TableColumn];
    expect(tabla).toBe('Asociado');
    expect(columna).toMatchObject({
      name: 'motivoInactivacion',
      type: 'varchar',
      length: '500',
      isNullable: true,
    });
  });

  it('no vuelve a agregar la columna si ya existe', async () => {
    const { queryRunner, addColumn } = crearQueryRunner(true);
    await new AddMotivoInactivacionToAsociado1724685970000().up(queryRunner);
    expect(addColumn).not.toHaveBeenCalled();
  });

  it('elimina la columna en down', async () => {
    const { queryRunner, dropColumn } = crearQueryRunner(true);
    await new AddMotivoInactivacionToAsociado1724685970000().down(queryRunner);
    expect(dropColumn).toHaveBeenCalledWith('Asociado', 'motivoInactivacion');
  });
});
