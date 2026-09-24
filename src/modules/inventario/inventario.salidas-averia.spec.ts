import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from '../../common/enums/role.enum';
import { TipoMovimientoInventario } from '../../common/enums/tipo-movimiento-inventario.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  AVERIA_ADMIN_NOT_FOUND,
  AVERIA_FONTANERO_FORBIDDEN,
} from '../averias/averias.service';
import { Averia } from '../averias/entities/averia.entity';
import { AlertaReposicion } from './entities/alerta-reposicion.entity';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DetalleReposicionMaterial } from './entities/detalle-reposicion-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { ReposicionMaterial } from './entities/reposicion-material.entity';
import { InventarioService } from './inventario.service';

describe('InventarioService.findMovimientosByAveria — 2.7.1', () => {
  let service: InventarioService;
  let averiaFindOne: jest.Mock;
  let movimientoFind: jest.Mock;
  let materialSave: jest.Mock;

  const fontanero: AuthenticatedUser = {
    userId: '5',
    idUsuario: 5,
    email: 'fontanero@asada.test',
    role: Role.FONTANERO,
    name: 'Fontanero',
  };
  const otroFontanero: AuthenticatedUser = {
    userId: '9',
    idUsuario: 9,
    email: 'otro@asada.test',
    role: Role.FONTANERO,
    name: 'Otro Fontanero',
  };
  const administradora: AuthenticatedUser = {
    userId: '1',
    idUsuario: 1,
    email: 'admin@asada.test',
    role: Role.ADMINISTRADORA,
    name: 'Administradora',
  };
  const secretaria: AuthenticatedUser = {
    userId: '2',
    idUsuario: 2,
    email: 'secretaria@asada.test',
    role: Role.SECRETARIA,
    name: 'Secretaria',
  };

  const salidas = [
    {
      id: 10,
      tipo: TipoMovimientoInventario.SALIDA,
      idAveria: 7,
      idMaterial: 3,
      cantidad: 2,
    },
  ];

  beforeEach(async () => {
    averiaFindOne = jest.fn();
    movimientoFind = jest.fn().mockResolvedValue(salidas);
    materialSave = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventarioService,
        {
          provide: getRepositoryToken(Material),
          useValue: { save: materialSave },
        },
        { provide: getRepositoryToken(CategoriaMaterial), useValue: {} },
        { provide: getRepositoryToken(Proveedor), useValue: {} },
        {
          provide: getRepositoryToken(MovimientoInventario),
          useValue: { find: movimientoFind },
        },
        {
          provide: getRepositoryToken(DocumentoMovimientoInventario),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Averia),
          useValue: { findOne: averiaFindOne },
        },
        { provide: getRepositoryToken(AlertaReposicion), useValue: {} },
        { provide: getRepositoryToken(ReposicionMaterial), useValue: {} },
        {
          provide: getRepositoryToken(DetalleReposicionMaterial),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get(InventarioService);
  });

  it('Fontanero asignado consulta las salidas de su avería', async () => {
    averiaFindOne.mockResolvedValue({ id: 7, idFontaneroAsignado: 5 });

    const result = await service.findMovimientosByAveria(7, fontanero);

    expect(averiaFindOne).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(movimientoFind).toHaveBeenCalledWith({
      where: { idAveria: 7, tipo: TipoMovimientoInventario.SALIDA },
      relations: { material: true },
      order: { id: 'DESC' },
    });
    expect(result).toEqual(salidas);
    expect(materialSave).not.toHaveBeenCalled();
  });

  it('otro Fontanero recibe 403 y no ve movimientos', async () => {
    averiaFindOne.mockResolvedValue({ id: 7, idFontaneroAsignado: 5 });

    await expect(
      service.findMovimientosByAveria(7, otroFontanero),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.findMovimientosByAveria(7, otroFontanero),
    ).rejects.toThrow(AVERIA_FONTANERO_FORBIDDEN);
    expect(movimientoFind).not.toHaveBeenCalled();
    expect(materialSave).not.toHaveBeenCalled();
  });

  it('Administradora consulta sin filtro de asignación', async () => {
    averiaFindOne.mockResolvedValue({ id: 7, idFontaneroAsignado: 5 });

    await expect(
      service.findMovimientosByAveria(7, administradora),
    ).resolves.toEqual(salidas);
    expect(movimientoFind).toHaveBeenCalled();
  });

  it('Secretaria consulta sin filtro de asignación', async () => {
    averiaFindOne.mockResolvedValue({ id: 7, idFontaneroAsignado: 5 });

    await expect(
      service.findMovimientosByAveria(7, secretaria),
    ).resolves.toEqual(salidas);
  });

  it('avería inexistente responde 404', async () => {
    averiaFindOne.mockResolvedValue(null);

    await expect(
      service.findMovimientosByAveria(999, administradora),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.findMovimientosByAveria(999, administradora),
    ).rejects.toThrow(AVERIA_ADMIN_NOT_FOUND);
    expect(movimientoFind).not.toHaveBeenCalled();
  });

  it('rechaza un id de avería inválido', async () => {
    await expect(
      service.findMovimientosByAveria(0, fontanero),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(averiaFindOne).not.toHaveBeenCalled();
  });
});
