import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asociado } from './entities/asociado.entity';
import { CreateAsociadoDto } from './dto/create-asociado.dto';

@Injectable()
export class AsociadosService {
  private readonly logger = new Logger(AsociadosService.name);

  constructor(
    @InjectRepository(Asociado)
    private readonly asociadoRepository: Repository<Asociado>,
  ) {}

  /**
   * Registra un nuevo asociado dentro del sistema.
   * Valida unicidad de cédula, establece activo = true y asigna fechas correspondientes.
   */
  async create(dto: CreateAsociadoDto): Promise<Asociado> {
    const cedulaNormalizada = dto.cedula.trim();

    // 1. Verificar si ya existe un asociado con la misma cédula
    const asociadoExistente = await this.asociadoRepository.findOne({
      where: { cedula: cedulaNormalizada },
    });

    if (asociadoExistente) {
      throw new ConflictException(
        `Ya existe un asociado registrado con la cédula "${cedulaNormalizada}"`,
      );
    }

    // 2. Preparar la entidad
    const fechaRegistro = dto.fechaRegistro
      ? new Date(dto.fechaRegistro)
      : new Date();

    const nuevoAsociado = this.asociadoRepository.create({
      nombre: dto.nombre.trim(),
      apellidos: dto.apellidos.trim(),
      cedula: cedulaNormalizada,
      correoElectronico: dto.correoElectronico.trim().toLowerCase(),
      activo: true,
      fechaRegistro,
      fechaInactivacion: null,
    });

    // 3. Persistir en la base de datos controlando posibles condiciones de carrera
    try {
      const guardado = await this.asociadoRepository.save(nuevoAsociado);
      this.logger.log(
        `Asociado registrado exitosamente: id=${guardado.id}, cedula=${guardado.cedula}`,
      );
      return guardado;
    } catch (error: any) {
      if (
        error?.number === 2601 ||
        error?.number === 2627 ||
        error?.code === '23505' ||
        error?.message?.includes('UQ_') ||
        error?.message?.includes('duplicate')
      ) {
        throw new ConflictException(
          `Ya existe un asociado registrado con la cédula "${cedulaNormalizada}"`,
        );
      }
      throw error;
    }
  }

  async findById(id: number): Promise<Asociado | null> {
    return this.asociadoRepository.findOne({ where: { id } });
  }

  async findByCedula(cedula: string): Promise<Asociado | null> {
    return this.asociadoRepository.findOne({
      where: { cedula: cedula.trim() },
    });
  }

  async findAll(): Promise<Asociado[]> {
    return this.asociadoRepository.find({ order: { id: 'ASC' } });
  }
}
