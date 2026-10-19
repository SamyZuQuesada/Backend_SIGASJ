import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CreatePuestoDto } from './dto/create-puesto.dto';
import { UpdatePuestoDto } from './dto/update-puesto.dto';
import { Puesto } from './entities/puesto.entity';

@Injectable()
export class PuestosService {
  private readonly logger = new Logger(PuestosService.name);

  constructor(
    @InjectRepository(Puesto)
    private readonly puestoRepository: Repository<Puesto>,
  ) {}

  async create(dto: CreatePuestoDto): Promise<Puesto> {
    const nombre = dto.nombre.trim();
    if (await this.puestoRepository.exists({ where: { nombre } })) {
      throw new ConflictException(`Ya existe el puesto "${nombre}"`);
    }
    const puesto = this.puestoRepository.create({
      nombre,
      critico: dto.critico ?? false,
      activo: dto.activo ?? true,
    });
    const guardado = await this.puestoRepository.save(puesto);
    this.logger.log(`Puesto creado id=${guardado.id}`);
    return guardado;
  }

  findAll(soloActivos = false): Promise<Puesto[]> {
    return this.puestoRepository.find({
      where: soloActivos ? { activo: true } : undefined,
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Puesto> {
    const puesto = await this.puestoRepository.findOneBy({ id });
    if (!puesto) {
      throw new NotFoundException(`No existe el puesto con id ${id}`);
    }
    return puesto;
  }

  async update(id: number, dto: UpdatePuestoDto): Promise<Puesto> {
    const puesto = await this.findOne(id);
    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();
      const conflicto = await this.puestoRepository.exists({
        where: { nombre, id: Not(id) },
      });
      if (conflicto) {
        throw new ConflictException(`Ya existe el puesto "${nombre}"`);
      }
      puesto.nombre = nombre;
    }
    if (dto.critico !== undefined) puesto.critico = dto.critico;
    if (dto.activo !== undefined) puesto.activo = dto.activo;
    await this.puestoRepository.save(puesto);
    return this.findOne(id);
  }
}
