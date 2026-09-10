import { ACTIVIDADES_MSG } from './actividades-fontanero.messages';

describe('ACTIVIDADES_MSG — contrato de mensajes', () => {
  it('expone mensajes clave en español sin jerga técnica', () => {
    expect(ACTIVIDADES_MSG.unauthorized).toBe('No autenticado');
    expect(ACTIVIDADES_MSG.forbidden).toBe('Acceso denegado');
    expect(ACTIVIDADES_MSG.actividadNotFound).toBe('Actividad no encontrada');
    expect(ACTIVIDADES_MSG.tipoNotFound).toBe(
      'Tipo de actividad no encontrado',
    );
    expect(ACTIVIDADES_MSG.rangoFechasInvalido).toContain('fechaInicio');
    expect(ACTIVIDADES_MSG.interno).toBe('Error interno del servidor');

    const serialized = JSON.stringify(ACTIVIDADES_MSG);
    expect(serialized).not.toMatch(/TypeORM|QueryFailedError|SQL Server/i);
  });

  it('mantiene mensajes estables para el Frontend', () => {
    expect(ACTIVIDADES_MSG.yaRevisada).toBe('La actividad ya fue revisada');
    expect(ACTIVIDADES_MSG.tipoInactivo).toBe(
      'El tipo de actividad no está activo',
    );
    expect(ACTIVIDADES_MSG.documentoRequerido).toBe(
      'Debe adjuntar un archivo.',
    );
  });
});
