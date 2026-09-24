import type { Repository } from 'typeorm';
import type { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { Comunicado } from './entities/comunicado.entity';

type ComunicadoDemo = CreateComunicadoDto & { id: string };

/**
 * Avisos sintéticos para desarrollo local de la landing.
 * No son comunicados oficiales de la ASADA. IDs fijos para no duplicar.
 */
export const COMUNICADOS_DEMO: readonly ComunicadoDemo[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    titulo: '[Demo] Mantenimiento programado de tubería',
    descripcion:
      'Aviso de demostración para la landing. Simula un mantenimiento preventivo en la red de distribución.',
    contenido:
      'Este comunicado es de prueba. Permite revisar título, prioridad alta y el detalle en la sección pública de comunicados.',
    tipo: 'Mantenimiento',
    prioridad: 'Alta',
    estado: 'Activo',
    esPublico: true,
    fechaPublicacion: '2026-09-22T15:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    titulo: '[Demo] Recomendaciones de uso responsable del agua',
    descripcion:
      'Aviso de demostración para la landing. Recuerda hábitos básicos de ahorro en el hogar.',
    contenido:
      'Este comunicado es de prueba. Permite revisar un aviso informativo vigente en el carrusel público.',
    tipo: 'Informativo',
    prioridad: 'Media',
    estado: 'Activo',
    esPublico: true,
    fechaPublicacion: '2026-09-20T15:00:00.000Z',
  },
];

export async function asegurarComunicadosDemo(
  comunicados: Repository<Comunicado>,
): Promise<number> {
  const existentes = await comunicados.find();
  const ids = new Set(existentes.map((item) => item.id));
  const titulos = new Set(existentes.map((item) => item.titulo));
  let creados = 0;

  for (const demo of COMUNICADOS_DEMO) {
    if (ids.has(demo.id) || titulos.has(demo.titulo)) {
      continue;
    }

    await comunicados.save(
      comunicados.create({
        id: demo.id,
        titulo: demo.titulo,
        descripcion: demo.descripcion ?? '',
        contenido: demo.contenido ?? null,
        tipo: demo.tipo ?? 'Informativo',
        prioridad: demo.prioridad ?? 'Media',
        estado: demo.estado === 'Inactivo' ? 'Inactivo' : 'Activo',
        esPublico: demo.esPublico !== false,
        fechaPublicacion: demo.fechaPublicacion
          ? new Date(demo.fechaPublicacion)
          : new Date(),
        fechaExpiracion: null,
        imagenUrl: null,
      }),
    );
    ids.add(demo.id);
    titulos.add(demo.titulo);
    creados += 1;
  }

  return creados;
}
