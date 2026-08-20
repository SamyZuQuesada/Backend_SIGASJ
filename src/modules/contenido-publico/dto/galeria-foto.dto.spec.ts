import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CreateGaleriaFotoDto,
  ListGaleriaFotoQueryDto,
  UpdateGaleriaFotoActivoDto,
} from './galeria-foto.dto';

describe('GaleriaFoto DTO transforms', () => {
  it('interpreta activo=false desde multipart como boolean false', () => {
    const dto = plainToInstance(CreateGaleriaFotoDto, {
      textoAlternativo: 'Alt',
      activo: 'false',
    });

    expect(dto.activo).toBe(false);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('interpreta activo=true desde multipart como boolean true', () => {
    const dto = plainToInstance(CreateGaleriaFotoDto, {
      textoAlternativo: 'Alt',
      activo: 'true',
    });

    expect(dto.activo).toBe(true);
  });

  it('interpreta filtro activo=false en query como boolean false', () => {
    const dto = plainToInstance(ListGaleriaFotoQueryDto, {
      activo: 'false',
    });

    expect(dto.activo).toBe(false);
  });

  it('interpreta body activo en patch dedicado', () => {
    const dto = plainToInstance(UpdateGaleriaFotoActivoDto, {
      activo: 'false',
    });

    expect(dto.activo).toBe(false);
    expect(validateSync(dto)).toHaveLength(0);
  });
});
