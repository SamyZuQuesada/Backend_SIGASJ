import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Colaborador } from '../entities/colaborador.entity';
import { PermisoColaborador } from '../entities/permiso-colaborador.entity';
import {
  ColaboradoresTestApp,
  crearColaboradoresTestApp,
} from './colaboradores.test-app';

export const PERMISOS_URL = '/api/v1/rrhh/permisos';

export type PermisosTestApp = ColaboradoresTestApp & {
  permisoRepository: Repository<PermisoColaborador>;
  crearColaborador: (extra?: Partial<Colaborador>) => Promise<Colaborador>;
};

export async function crearPermisosTestApp(): Promise<PermisosTestApp> {
  const ctx = await crearColaboradoresTestApp();
  const permisoRepository = ctx.app.get<Repository<PermisoColaborador>>(
    getRepositoryToken(PermisoColaborador),
  );

  const crearColaborador = async (
    extra: Partial<Colaborador> = {},
  ): Promise<Colaborador> => {
    const n = String(Math.floor(1000 + Math.random() * 8999));
    const m = String(Math.floor(1000 + Math.random() * 8999));
    return ctx.colaboradorRepository.save(
      ctx.colaboradorRepository.create({
        nombre: extra.nombre ?? 'Carlos',
        apellidos: extra.apellidos ?? 'Pérez Mora',
        cedula: extra.cedula ?? `1-${n}-${m}`,
        correoElectronico:
          extra.correoElectronico ?? `colab.${n}${m}@asadasanjuan.cr`,
        cargo: extra.cargo ?? 'Fontanero',
        activo: extra.activo ?? true,
        usuarioId: extra.usuarioId ?? null,
      }),
    );
  };

  return { ...ctx, permisoRepository, crearColaborador };
}
