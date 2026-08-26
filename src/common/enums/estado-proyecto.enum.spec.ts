import {
  ESTADO_PROYECTO_LABELS,
  EstadoProyecto,
  isEstadoProyectoValido,
} from './estado-proyecto.enum';

describe('EstadoProyecto Enum', () => {
  it('debe contener exactamente los tres estados oficiales', () => {
    const estados = Object.values(EstadoProyecto);
    expect(estados).toHaveLength(3);
    expect(estados).toContain(EstadoProyecto.PENDIENTE);
    expect(estados).toContain(EstadoProyecto.EN_PROCESO);
    expect(estados).toContain(EstadoProyecto.COMPLETADO);
  });

  it('debe reconocer únicamente los tres estados válidos', () => {
    expect(isEstadoProyectoValido('PENDIENTE')).toBe(true);
    expect(isEstadoProyectoValido('EN_PROCESO')).toBe(true);
    expect(isEstadoProyectoValido('COMPLETADO')).toBe(true);
  });

  it('debe rechazar estados improvisados o inválidos', () => {
    const estadosInvalidos = [
      'Terminado',
      'Finalizado',
      'Trabajando',
      'Iniciado',
      'Por hacer',
      'EN_PLANIFICACION',
      'EN_EJECUCION',
      'PAUSADO',
      'invalid',
      '',
    ];

    estadosInvalidos.forEach((estado) => {
      expect(isEstadoProyectoValido(estado)).toBe(false);
    });
  });

  it('debe mapear correctamente las etiquetas legibles para el usuario', () => {
    expect(ESTADO_PROYECTO_LABELS[EstadoProyecto.PENDIENTE]).toBe('Pendiente');
    expect(ESTADO_PROYECTO_LABELS[EstadoProyecto.EN_PROCESO]).toBe('En proceso');
    expect(ESTADO_PROYECTO_LABELS[EstadoProyecto.COMPLETADO]).toBe('Completado');
  });
});
