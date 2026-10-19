import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Colaborador } from '../entities/colaborador.entity';
import { Incapacidad } from '../entities/incapacidad.entity';
import {
  ColaboradoresTestApp,
  crearColaboradoresTestApp,
} from './colaboradores.test-app';

export const INCAPACIDADES_URL = '/api/v1/rrhh/incapacidades';

export type IncapacidadesTestApp = ColaboradoresTestApp & {
  incapacidadRepository: Repository<Incapacidad>;
  crearColaborador: (extra?: Partial<Colaborador>) => Promise<Colaborador>;
};

export async function crearIncapacidadesTestApp(): Promise<IncapacidadesTestApp> {
  const ctx = await crearColaboradoresTestApp();
  const incapacidadRepository = ctx.app.get<Repository<Incapacidad>>(
    getRepositoryToken(Incapacidad),
  );

  const crearColaborador = async (
    extra: Partial<Colaborador> = {},
  ): Promise<Colaborador> => {
    const n = String(Math.floor(1000 + Math.random() * 8999));
    const m = String(Math.floor(1000 + Math.random() * 8999));
    const puesto =
      extra.puestoId != null
        ? await ctx.puestoRepository.findOneByOrFail({ id: extra.puestoId })
        : await ctx.seedPuesto(extra.cargo ?? 'Fontanero');
    return ctx.colaboradorRepository.save(
      ctx.colaboradorRepository.create({
        nombre: extra.nombre ?? 'Ana',
        apellidos: extra.apellidos ?? 'Rojas Mora',
        cedula: extra.cedula ?? `1-${n}-${m}`,
        correoElectronico:
          extra.correoElectronico ?? `colab.${n}${m}@asadasanjuan.cr`,
        cargo: puesto.nombre,
        puestoId: puesto.id,
        activo: extra.activo ?? true,
        usuarioId: extra.usuarioId ?? null,
      }),
    );
  };

  return { ...ctx, incapacidadRepository, crearColaborador };
}
