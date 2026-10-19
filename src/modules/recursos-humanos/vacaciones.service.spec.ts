import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';
import { Colaborador } from './entities/colaborador.entity';
import { MovimientoVacaciones } from './entities/movimiento-vacaciones.entity';
import {
  crearPermisosTestApp,
  PermisosTestApp,
} from './testing/permisos-colaborador.test-app';
import { VacacionesService } from './vacaciones.service';

const { ACUMULADO, DISFRUTADO } = TipoMovimientoVacaciones;

describe('VacacionesService (SQL.js)', () => {
  let ctx: PermisosTestApp;
  let service: VacacionesService;
  let movimientoRepository: Repository<MovimientoVacaciones>;
  let colaborador: Colaborador;

  beforeAll(async () => {
    ctx = await crearPermisosTestApp();
    service = ctx.app.get(VacacionesService);
    movimientoRepository = ctx.app.get<Repository<MovimientoVacaciones>>(
      getRepositoryToken(MovimientoVacaciones),
    );
    colaborador = await ctx.crearColaborador({ cedula: '1-0001-0001' });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await movimientoRepository.clear();
  });

  describe('registrarMovimiento', () => {
    it('registra un movimiento ligado al colaborador', async () => {
      const movimiento = await service.registrarMovimiento({
        colaboradorId: colaborador.id,
        tipo: ACUMULADO,
        cantidadDias: 12,
        fecha: '2026-01-01',
        observaciones: '  Periodo 2025  ',
      });

      expect(movimiento.id).toBeDefined();
      expect(movimiento.colaboradorId).toBe(colaborador.id);
      expect(movimiento.tipo).toBe(ACUMULADO);
      expect(movimiento.cantidadDias).toBe(12);
      expect(movimiento.fecha).toBe('2026-01-01');
      expect(movimiento.observaciones).toBe('Periodo 2025');
      expect(movimiento.createdAt).toBeInstanceOf(Date);

      const persistido = await movimientoRepository.findOne({
        where: { id: movimiento.id },
        relations: { colaborador: true },
      });
      expect(persistido?.colaborador.id).toBe(colaborador.id);
    });

    it('rechaza colaborador inexistente (400, igual que permisos)', async () => {
      await expect(
        service.registrarMovimiento({
          colaboradorId: 999_999,
          tipo: ACUMULADO,
          cantidadDias: 1,
          fecha: '2026-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(await movimientoRepository.count()).toBe(0);
    });

    it('rechaza tipo fuera del catálogo', async () => {
      await expect(
        service.registrarMovimiento({
          colaboradorId: colaborador.id,
          tipo: 'PENDIENTE' as TipoMovimientoVacaciones,
          cantidadDias: 1,
          fecha: '2026-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([0, -2, 1.5])(
      'rechaza cantidadDias inválida (%p)',
      async (cantidadDias) => {
        await expect(
          service.registrarMovimiento({
            colaboradorId: colaborador.id,
            tipo: DISFRUTADO,
            cantidadDias,
            fecha: '2026-01-01',
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it('rechaza fecha inválida', async () => {
      await expect(
        service.registrarMovimiento({
          colaboradorId: colaborador.id,
          tipo: DISFRUTADO,
          cantidadDias: 1,
          fecha: '2026-02-30',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('Saldo nunca negativo', () => {
    const disfrutar = (cantidadDias: number, colaboradorId = colaborador.id) =>
      service.registrarMovimiento({
        colaboradorId,
        tipo: DISFRUTADO,
        cantidadDias,
        fecha: '2026-06-01',
      });

    it('rechaza disfrutar sin saldo acumulado', async () => {
      await expect(disfrutar(1)).rejects.toBeInstanceOf(BadRequestException);
      await expect(disfrutar(1)).rejects.toThrow(/saldo suficiente/i);
      expect(await movimientoRepository.count()).toBe(0);
    });

    it('rechaza disfrutar más días que el saldo disponible', async () => {
      await service.registrarMovimiento({
        colaboradorId: colaborador.id,
        tipo: ACUMULADO,
        cantidadDias: 5,
        fecha: '2026-01-01',
      });

      await expect(disfrutar(6)).rejects.toBeInstanceOf(BadRequestException);
      expect(
        (await service.calcularSaldo(colaborador.id)).diasDisponibles,
      ).toBe(5);
      expect(await movimientoRepository.count()).toBe(1);
    });

    it('permite disfrutar exactamente el saldo y deja el saldo en cero', async () => {
      await service.registrarMovimiento({
        colaboradorId: colaborador.id,
        tipo: ACUMULADO,
        cantidadDias: 5,
        fecha: '2026-01-01',
      });

      await expect(disfrutar(5)).resolves.toMatchObject({ cantidadDias: 5 });
      expect(
        (await service.calcularSaldo(colaborador.id)).diasDisponibles,
      ).toBe(0);
      await expect(disfrutar(1)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('el saldo de otro colaborador no cubre el disfrute', async () => {
      const otro = await ctx.crearColaborador({ cedula: '1-0009-0009' });
      await service.registrarMovimiento({
        colaboradorId: otro.id,
        tipo: ACUMULADO,
        cantidadDias: 10,
        fecha: '2026-01-01',
      });

      await expect(disfrutar(1)).rejects.toBeInstanceOf(BadRequestException);
      expect((await service.calcularSaldo(otro.id)).diasDisponibles).toBe(10);
    });
  });

  describe('calcularSaldo', () => {
    it('devuelve cero para un colaborador sin movimientos', async () => {
      await expect(service.calcularSaldo(colaborador.id)).resolves.toEqual({
        colaboradorId: colaborador.id,
        totalMovimientos: 0,
        diasAcumulados: 0,        diasAjusteNeto: 0,        diasDisfrutados: 0,
        diasDisponibles: 0,
      });
    });

    it('deriva el saldo del historial sin modificar un único número', async () => {
      const registrar = (
        tipo: TipoMovimientoVacaciones,
        cantidadDias: number,
        fecha: string,
      ) =>
        service.registrarMovimiento({
          colaboradorId: colaborador.id,
          tipo,
          cantidadDias,
          fecha,
        });

      await registrar(ACUMULADO, 12, '2026-01-01');
      expect(
        (await service.calcularSaldo(colaborador.id)).diasDisponibles,
      ).toBe(12);

      await registrar(DISFRUTADO, 3, '2026-03-10');
      expect(
        (await service.calcularSaldo(colaborador.id)).diasDisponibles,
      ).toBe(9);

      await registrar(DISFRUTADO, 5, '2026-07-01');
      await registrar(ACUMULADO, 2, '2026-08-01');

      await expect(service.calcularSaldo(colaborador.id)).resolves.toEqual({
        colaboradorId: colaborador.id,
        totalMovimientos: 4,
        diasAcumulados: 14,        diasAjusteNeto: 0,        diasDisfrutados: 8,
        diasDisponibles: 6,
      });

      // El historial se conserva íntegro.
      expect(await movimientoRepository.count()).toBe(4);
    });

    it('no mezcla el saldo entre colaboradores', async () => {
      const otro = await ctx.crearColaborador({ cedula: '1-0002-0002' });
      await service.registrarMovimiento({
        colaboradorId: colaborador.id,
        tipo: ACUMULADO,
        cantidadDias: 10,
        fecha: '2026-01-01',
      });
      await service.registrarMovimiento({
        colaboradorId: otro.id,
        tipo: ACUMULADO,
        cantidadDias: 4,
        fecha: '2026-01-01',
      });

      expect(
        (await service.calcularSaldo(colaborador.id)).diasDisponibles,
      ).toBe(10);
      expect((await service.calcularSaldo(otro.id)).diasDisponibles).toBe(4);
    });

    it('rechaza colaborador inexistente', async () => {
      await expect(service.calcularSaldo(999_999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('historial', () => {
    it('lista los movimientos del más reciente al más antiguo', async () => {
      await service.registrarMovimiento({
        colaboradorId: colaborador.id,
        tipo: ACUMULADO,
        cantidadDias: 12,
        fecha: '2026-01-01',
      });
      await service.registrarMovimiento({
        colaboradorId: colaborador.id,
        tipo: DISFRUTADO,
        cantidadDias: 3,
        fecha: '2026-03-10',
      });

      const historial = await service.historial(colaborador.id);
      expect(historial.map((m) => m.fecha)).toEqual([
        '2026-03-10',
        '2026-01-01',
      ]);
      expect(historial.map((m) => m.tipo)).toEqual([DISFRUTADO, ACUMULADO]);
    });
  });

  describe('Integridad referencial', () => {
    it('elimina los movimientos al eliminar el colaborador (CASCADE)', async () => {
      const temporal = await ctx.crearColaborador({ cedula: '1-0003-0003' });
      await service.registrarMovimiento({
        colaboradorId: temporal.id,
        tipo: ACUMULADO,
        cantidadDias: 5,
        fecha: '2026-01-01',
      });
      expect(
        await movimientoRepository.countBy({ colaboradorId: temporal.id }),
      ).toBe(1);

      await ctx.colaboradorRepository.delete({ id: temporal.id });

      expect(
        await movimientoRepository.countBy({ colaboradorId: temporal.id }),
      ).toBe(0);
    });
  });
});
