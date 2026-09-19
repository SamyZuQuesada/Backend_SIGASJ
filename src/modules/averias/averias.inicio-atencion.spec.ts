import { BadRequestException } from '@nestjs/common';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import {
  MOTIVO_DENTRO_DE_HORARIO,
  MOTIVO_FUERA_DE_HORARIO,
  ResultadoHorarioLaboral,
  type EvaluacionHorarioLaboral,
} from '../usuarios/validacion-horario-laboral-fontanero';
import { esTransicionEstadoAveriaValida } from './averias.estado-transiciones';
import {
  ESTADOS_QUE_PERMITEN_INICIAR_ATENCION,
  MENSAJE_INICIO_ATENCION_FUERA_DE_HORARIO,
  assertHorarioPermiteIniciarAtencion,
  registrarInicioAtencionExitoso,
} from './averias.inicio-atencion';
import { Averia } from './entities/averia.entity';

const evaluacion = (
  overrides: Partial<EvaluacionHorarioLaboral>,
): EvaluacionHorarioLaboral => ({
  resultado: ResultadoHorarioLaboral.DENTRO_DE_HORARIO,
  puedeIniciarAtencion: true,
  idFontanero: 7,
  momento: '2026-09-21T16:00:00.000Z',
  diaSemana: 1,
  horario: null,
  motivo: MOTIVO_DENTRO_DE_HORARIO,
  ...overrides,
});

describe('inicio de atención por horario', () => {
  it('permite ASIGNADA y PENDIENTE → EN_ATENCION en el grafo 2.3', () => {
    for (const desde of ESTADOS_QUE_PERMITEN_INICIAR_ATENCION) {
      expect(
        esTransicionEstadoAveriaValida(desde, EstadoAveria.EN_ATENCION),
      ).toBe(true);
    }
  });

  it('rechaza fuera de horario con el mensaje de negocio', () => {
    expect(() =>
      assertHorarioPermiteIniciarAtencion(
        evaluacion({
          resultado: ResultadoHorarioLaboral.FUERA_DE_HORARIO,
          puedeIniciarAtencion: false,
          motivo: MOTIVO_FUERA_DE_HORARIO,
        }),
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      assertHorarioPermiteIniciarAtencion(
        evaluacion({
          resultado: ResultadoHorarioLaboral.SIN_HORARIO_CONFIGURADO,
          puedeIniciarAtencion: false,
        }),
      ),
    ).toThrow(MENSAJE_INICIO_ATENCION_FUERA_DE_HORARIO);
  });

  it('registra estado y fecha solo en una transición exitosa', () => {
    const averia = {
      estado: EstadoAveria.PENDIENTE,
      fechaInicioAtencion: null,
    } as Averia;
    const momento = new Date('2026-09-21T16:05:00.000Z');
    registrarInicioAtencionExitoso(averia, momento);
    expect(averia.estado).toBe(EstadoAveria.EN_ATENCION);
    expect(averia.fechaInicioAtencion).toEqual(momento);
  });
});
