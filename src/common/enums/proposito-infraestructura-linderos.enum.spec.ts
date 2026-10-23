import {
  isPropositoInfraestructuraLinderosConfirmado,
  PROPOSITOS_INFRAESTRUCTURA_LINDEROS_CONFIRMADOS,
  PropositoInfraestructuraLinderosConfirmado,
} from './proposito-infraestructura-linderos.enum';

describe('PropositoInfraestructuraLinderosConfirmado (INFRA-QA-002)', () => {
  it('solo confirma «Reunión de fincas» — segundo propósito BLOCKED sin PDF oficial', () => {
    expect(PROPOSITOS_INFRAESTRUCTURA_LINDEROS_CONFIRMADOS).toEqual([
      PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS,
    ]);
    expect(PROPOSITOS_INFRAESTRUCTURA_LINDEROS_CONFIRMADOS).toHaveLength(1);
  });

  it('rechaza propósitos inventados', () => {
    expect(isPropositoInfraestructuraLinderosConfirmado('Ampliación')).toBe(
      false,
    );
    expect(
      isPropositoInfraestructuraLinderosConfirmado('Reunión de fincas'),
    ).toBe(true);
  });
});
