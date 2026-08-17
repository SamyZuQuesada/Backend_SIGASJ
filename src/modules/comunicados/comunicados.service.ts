import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class ComunicadosService {
  private comunicados = [
    {
      id: '1',
      titulo: 'Mantenimiento Programado de Red de Agua',
      descripcion:
        'Se realizará suspensión temporal del servicio por reparaciones en el sector principal.',
      tipo: 'Mantenimiento',
      prioridad: 'Alta',
      estado: 'Activo',
      esPublico: true,
      fechaPublicacion: new Date().toISOString(),
      fechaExpiracion: null,
    },
    {
      id: '2',
      titulo: 'Asamblea General Ordinaria de Abonados',
      descripcion:
        'Invitación a todos los abonados a la asamblea anual de la ASADA San Juan.',
      tipo: 'Informativo',
      prioridad: 'Media',
      estado: 'Activo',
      esPublico: true,
      fechaPublicacion: new Date().toISOString(),
      fechaExpiracion: null,
    },
  ];

  findPublicos() {
    // Retorna únicamente los comunicados activos y públicos
    return this.comunicados.filter((c) => c.estado === 'Activo' && c.esPublico);
  }

  findAllAdmin() {
    return this.comunicados;
  }

  findOne(id: string) {
    const comunicado = this.comunicados.find((c) => c.id === id);
    if (!comunicado) {
      throw new NotFoundException(`Comunicado con ID ${id} no encontrado`);
    }
    return comunicado;
  }
}
