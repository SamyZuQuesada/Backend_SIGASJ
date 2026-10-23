import {
  TipoPersonaInfraestructuraLinderos,
  isTipoPersonaInfraestructuraLinderosValido,
} from './tipo-persona-infraestructura-linderos.enum';

describe('TipoPersonaInfraestructuraLinderos', () => {
  it('expone exactamente persona física y jurídica', () => {
    expect(Object.values(TipoPersonaInfraestructuraLinderos)).toEqual([
      'Persona física',
      'Persona jurídica',
    ]);
  });

  it('valida opciones oficiales ignorando mayúsculas/espacios', () => {
    expect(isTipoPersonaInfraestructuraLinderosValido('Persona física')).toBe(
      true,
    );
    expect(
      isTipoPersonaInfraestructuraLinderosValido('  persona jurídica '),
    ).toBe(true);
    expect(isTipoPersonaInfraestructuraLinderosValido('Empresa')).toBe(false);
  });
});
