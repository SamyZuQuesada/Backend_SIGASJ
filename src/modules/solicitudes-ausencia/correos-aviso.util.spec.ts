import {
  normalizarCorreosAviso,
  parseCorreosAviso,
  validarListaCorreosAviso,
} from './correos-aviso.util';

describe('correos-aviso.util', () => {
  it('acepta un correo y varios separados por coma o espacio', () => {
    expect(parseCorreosAviso('  Aviso@AsadaSanJuan.cr  ')).toEqual([
      'aviso@asadasanjuan.cr',
    ]);
    expect(
      parseCorreosAviso(
        'aviso@asadasanjuan.cr, jefe@asadasanjuan.cr; otro@asada.cr',
      ),
    ).toEqual([
      'aviso@asadasanjuan.cr',
      'jefe@asadasanjuan.cr',
      'otro@asada.cr',
    ]);
    expect(
      parseCorreosAviso('uno@asada.cr dos@asada.cr uno@asada.cr'),
    ).toEqual(['uno@asada.cr', 'dos@asada.cr']);
  });

  it('normaliza a lista separada por coma', () => {
    expect(normalizarCorreosAviso('Uno@Asada.cr, DOS@asada.cr')).toBe(
      'uno@asada.cr, dos@asada.cr',
    );
  });

  it('rechaza vacío, inválidos y más de cinco', () => {
    expect(validarListaCorreosAviso('')).toMatch(/al menos un correo/i);
    expect(validarListaCorreosAviso('no-es-correo')).toMatch(/no es válido/i);
    expect(
      validarListaCorreosAviso(
        'a@a.cr, b@b.cr, c@c.cr, d@d.cr, e@e.cr, f@f.cr',
      ),
    ).toMatch(/hasta 5/i);
    expect(validarListaCorreosAviso('ok@asada.cr, malo')).toMatch(/malo/);
    expect(validarListaCorreosAviso('ok@asada.cr, jefe@asada.cr')).toBeNull();
  });
});
