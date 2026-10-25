import { BadRequestException } from '@nestjs/common';
import { fechaCalendarioEnAsada } from '../../common/time/reloj-asada';
import { validarFechaVencimientoMaterial } from './validar-vencimiento-material';

function sumarDias(iso: string, dias: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + dias))
    .toISOString()
    .slice(0, 10);
}

describe('validarFechaVencimientoMaterial', () => {
  const hoy = fechaCalendarioEnAsada(new Date());

  it('permite omitir la fecha cuando el material no vence', () => {
    expect(validarFechaVencimientoMaterial(false, null)).toBeNull();
  });

  it('exige fecha futura cuando el material requiere vencimiento', () => {
    expect(() => validarFechaVencimientoMaterial(true, null)).toThrow(
      BadRequestException,
    );
    expect(() =>
      validarFechaVencimientoMaterial(true, new Date(`${hoy}T00:00:00.000Z`)),
    ).toThrow('fecha futura');

    const manana = sumarDias(hoy, 1);
    const fecha = validarFechaVencimientoMaterial(
      true,
      new Date(`${manana}T00:00:00.000Z`),
    );
    expect(fecha).toBeInstanceOf(Date);
  });

  it('conserva una fecha pasada si el material no requiere vencimiento', () => {
    const fecha = validarFechaVencimientoMaterial(
      false,
      new Date('2020-01-01T00:00:00.000Z'),
    );
    expect(fecha?.toISOString().startsWith('2020-01-01')).toBe(true);
  });
});
