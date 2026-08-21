import { Injectable } from '@nestjs/common';

@Injectable()
export class ContenidoPublicoService {
  getInformacionInstitucional() {
    return {
      asada: 'ASADA San Juan',
      ubicacion: 'Santa Cruz, Guanacaste, Costa Rica',
      mision:
        'Proveer agua potable con calidad, continuidad y compromiso con la comunidad.',
      vision:
        'Ser una ASADA modelo en gestión comunitaria e infraestructura hídrica.',
      historia: 'Servicio de gestión de agua para la comunidad de San Juan.',
    };
  }

  getTransparencia() {
    return [
      {
        id: 1,
        titulo: 'Informe Anual de Gestión',
        ano: 2025,
        documentoUrl: '/docs/informe-2025.pdf',
      },
      {
        id: 2,
        titulo: 'Reglamento de Prestación de Servicios',
        ano: 2024,
        documentoUrl: '/docs/reglamento.pdf',
      },
    ];
  }
}
