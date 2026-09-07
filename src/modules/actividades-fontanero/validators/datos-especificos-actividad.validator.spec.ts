import { TipoActividadFontaneroCodigo } from '../../../common/enums/tipo-actividad-fontanero-codigo.enum';
import { validarDatosEspecificosActividad } from './datos-especificos-actividad.validator';

describe('validarDatosEspecificosActividad', () => {
  it('no exige campos adicionales mientras los formularios específicos están pendientes', () => {
    const errores = validarDatosEspecificosActividad({
      codigo: TipoActividadFontaneroCodigo.CONTROL_FUGAS,
    });

    expect(errores).toEqual([]);
  });
});
