import {
  Column,
  CreateDateColumn,
  DataSource,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FechasAuditoriaSubscriber } from './fechas-auditoria.subscriber';

@Entity('PruebaAuditoria')
class PruebaAuditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  nombre: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

describe('FechasAuditoriaSubscriber', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'sqljs',
      entities: [PruebaAuditoria],
      subscribers: [FechasAuditoriaSubscriber],
      synchronize: true,
    });
    await ds.initialize();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('escribe createdAt y updatedAt desde la aplicación al insertar', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-10-18T19:07:00.000Z'));
    const repo = ds.getRepository(PruebaAuditoria);

    const guardada = await repo.save(repo.create({ nombre: 'a' }));

    expect(guardada.createdAt.toISOString()).toBe('2026-10-18T19:07:00.000Z');
    expect(guardada.updatedAt.toISOString()).toBe('2026-10-18T19:07:00.000Z');
  });

  it('actualiza updatedAt con la hora de la aplicación y conserva createdAt', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-10-18T19:07:00.000Z'));
    const repo = ds.getRepository(PruebaAuditoria);
    const guardada = await repo.save(repo.create({ nombre: 'b' }));

    jest.setSystemTime(new Date('2026-10-19T01:30:00.000Z'));
    guardada.nombre = 'b2';
    await repo.save(guardada);

    const leida = await repo.findOneByOrFail({ id: guardada.id });
    expect(leida.nombre).toBe('b2');
    expect(leida.createdAt.getTime()).toBe(
      new Date('2026-10-18T19:07:00.000Z').getTime(),
    );
    expect(leida.updatedAt.getTime()).toBe(
      new Date('2026-10-19T01:30:00.000Z').getTime(),
    );
  });

  it('respeta un createdAt asignado explícitamente', async () => {
    const repo = ds.getRepository(PruebaAuditoria);
    const fija = new Date('2026-01-02T03:04:05.000Z');
    const guardada = await repo.save(
      repo.create({ nombre: 'c', createdAt: fija }),
    );
    expect(guardada.createdAt.toISOString()).toBe(fija.toISOString());
  });
});
