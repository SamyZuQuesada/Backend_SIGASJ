import {
  isTipoPersonaDisponibilidadServiciosValido,
  TIPOS_PERSONA_DISPONIBILIDAD_SERVICIOS,
  TipoPersonaDisponibilidadServicios,
} from './tipo-persona-disponibilidad-servicios.enum';

describe('TipoPersonaDisponibilidadServicios', () => {
  it('expone exactamente Persona física y Persona jurídica', () => {
    expect(TIPOS_PERSONA_DISPONIBILIDAD_SERVICIOS).toEqual([
      TipoPersonaDisponibilidadServicios.FISICA,
      TipoPersonaDisponibilidadServicios.JURIDICA,
    ]);
  });

  it('valida etiquetas oficiales (case-insensitive) y rechaza inventadas', () => {
    expect(isTipoPersonaDisponibilidadServiciosValido('Persona física')).toBe(
      true,
    );
    expect(isTipoPersonaDisponibilidadServiciosValido('PERSONA JURÍDICA')).toBe(
      true,
    );
    expect(isTipoPersonaDisponibilidadServiciosValido('Moral')).toBe(false);
    expect(isTipoPersonaDisponibilidadServiciosValido('')).toBe(false);
  });
});
