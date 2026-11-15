import { Role } from '../../common/enums/role.enum';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { MovimientosController } from './movimientos.controller';
import { ReportesController } from './reportes.controller';

describe('Inventario lectura — roles Admin + Secretaria', () => {
  it('movimientos.listar y obtener permiten ADMINISTRADORA y SECRETARIA', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, MovimientosController.prototype.listar),
    ).toEqual([Role.ADMINISTRADORA, Role.SECRETARIA_EJECUTIVA]);
    expect(
      Reflect.getMetadata(ROLES_KEY, MovimientosController.prototype.obtener),
    ).toEqual([Role.ADMINISTRADORA, Role.SECRETARIA_EJECUTIVA]);
  });

  it('reportes.resumen permite ADMINISTRADORA y SECRETARIA', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, ReportesController.prototype.resumen),
    ).toEqual([Role.ADMINISTRADORA, Role.SECRETARIA_EJECUTIVA]);
  });

  it('no incluye FONTANERO en lectura de historial/reportes admin', () => {
    const listar = Reflect.getMetadata(
      ROLES_KEY,
      MovimientosController.prototype.listar,
    ) as Role[];
    const resumen = Reflect.getMetadata(
      ROLES_KEY,
      ReportesController.prototype.resumen,
    ) as Role[];
    expect(listar).not.toContain(Role.FONTANERO);
    expect(resumen).not.toContain(Role.FONTANERO);
  });
});
