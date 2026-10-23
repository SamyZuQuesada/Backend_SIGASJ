import {
  isPropositoDisponibilidadServiciosConfirmado,
  propositoDisponibilidadRequierePlano,
  PROPOSITOS_DISPONIBILIDAD_SERVICIOS_CONFIRMADOS,
  PropositoDisponibilidadServiciosConfirmado,
} from './proposito-disponibilidad-servicios.enum';

describe('PropositoDisponibilidadServiciosConfirmado', () => {
  it('expone los propósitos confirmados desde documentRequirementsConfig (FE)', () => {
    expect(PROPOSITOS_DISPONIBILIDAD_SERVICIOS_CONFIRMADOS).toEqual([
      PropositoDisponibilidadServiciosConfirmado.FRACCIONAMIENTO,
      PropositoDisponibilidadServiciosConfirmado.URBANIZACION,
      PropositoDisponibilidadServiciosConfirmado.PROPIEDADES_EN_DERECHOS,
      PropositoDisponibilidadServiciosConfirmado.ESTACION_COMBUSTIBLE,
    ]);
  });

  it('valida etiquetas confirmadas y rechaza inventadas', () => {
    expect(
      isPropositoDisponibilidadServiciosConfirmado('Fraccionamiento'),
    ).toBe(true);
    expect(isPropositoDisponibilidadServiciosConfirmado('Ampliación XYZ')).toBe(
      false,
    );
  });

  it('marca propósitos que requieren plano según FE', () => {
    expect(propositoDisponibilidadRequierePlano('Urbanización')).toBe(true);
    expect(propositoDisponibilidadRequierePlano('Otro')).toBe(false);
  });
});
