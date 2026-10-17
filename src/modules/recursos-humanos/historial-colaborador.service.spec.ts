import { TipoEventoHistorialRrhh } from '../../common/enums/tipo-evento-historial-rrhh.enum';
import { EventoHistorialColaboradorDto } from './dto/historial-colaborador.dto';
import { compararEventosHistorial } from './historial-colaborador.service';

const evento = (
  partial: Partial<EventoHistorialColaboradorDto> &
    Pick<EventoHistorialColaboradorDto, 'id' | 'tipo' | 'fecha'>,
): EventoHistorialColaboradorDto => ({
  fechaInicio: null,
  fechaFin: null,
  descripcion: 'x',
  ...partial,
});

describe('compararEventosHistorial', () => {
  it('ordena por fecha descendente', () => {
    const a = evento({
      id: 1,
      tipo: TipoEventoHistorialRrhh.PERMISO,
      fecha: '2026-10-10',
    });
    const b = evento({
      id: 2,
      tipo: TipoEventoHistorialRrhh.PERMISO,
      fecha: '2026-10-20',
    });
    expect([a, b].sort(compararEventosHistorial).map((e) => e.id)).toEqual([
      2, 1,
    ]);
  });

  it('con la misma fecha usa tipo e id como desempate estable', () => {
    const permiso = evento({
      id: 10,
      tipo: TipoEventoHistorialRrhh.PERMISO,
      fecha: '2026-10-15',
    });
    const vacacion = evento({
      id: 20,
      tipo: TipoEventoHistorialRrhh.VACACION,
      fecha: '2026-10-15',
    });
    const incapacidad = evento({
      id: 5,
      tipo: TipoEventoHistorialRrhh.INCAPACIDAD,
      fecha: '2026-10-15',
    });
    const incapacidadMayor = evento({
      id: 50,
      tipo: TipoEventoHistorialRrhh.INCAPACIDAD,
      fecha: '2026-10-15',
    });

    expect(
      [permiso, vacacion, incapacidad, incapacidadMayor]
        .sort(compararEventosHistorial)
        .map((e) => `${e.tipo}:${e.id}`),
    ).toEqual(['INCAPACIDAD:50', 'INCAPACIDAD:5', 'PERMISO:10', 'VACACION:20']);
  });
});
