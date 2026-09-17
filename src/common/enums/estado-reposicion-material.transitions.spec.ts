import { EstadoReposicionMaterial } from './estado-reposicion-material.enum';
import {
  esTransicionEstadoReposicionValida,
  normalizarEstadoReposicionMaterial,
} from './estado-reposicion-material.transitions';

describe('Transiciones de estado de reposición de materiales', () => {
  it('permite avanzar PENDIENTE a EN_GESTION', () => {
    expect(
      esTransicionEstadoReposicionValida(
        EstadoReposicionMaterial.PENDIENTE,
        EstadoReposicionMaterial.EN_GESTION,
      ),
    ).toBe(true);
  });

  it('permite avanzar PENDIENTE_RECEPCION a RECIBIDA y RECIBIDA a COMPLETADA', () => {
    expect(
      esTransicionEstadoReposicionValida(
        EstadoReposicionMaterial.PENDIENTE_RECEPCION,
        EstadoReposicionMaterial.RECIBIDA,
      ),
    ).toBe(true);
    expect(
      esTransicionEstadoReposicionValida(
        EstadoReposicionMaterial.RECIBIDA,
        EstadoReposicionMaterial.COMPLETADA,
      ),
    ).toBe(true);
  });

  it('rechaza saltos inválidos', () => {
    expect(
      esTransicionEstadoReposicionValida(
        EstadoReposicionMaterial.PENDIENTE,
        EstadoReposicionMaterial.COMPLETADA,
      ),
    ).toBe(false);
    expect(
      esTransicionEstadoReposicionValida(
        EstadoReposicionMaterial.EN_GESTION,
        EstadoReposicionMaterial.RECIBIDA,
      ),
    ).toBe(false);
  });

  it('normaliza etiquetas legibles al valor del enum', () => {
    expect(normalizarEstadoReposicionMaterial('En gestión')).toBe(
      EstadoReposicionMaterial.EN_GESTION,
    );
    expect(normalizarEstadoReposicionMaterial('Pendiente de recepción')).toBe(
      EstadoReposicionMaterial.PENDIENTE_RECEPCION,
    );
  });
});
