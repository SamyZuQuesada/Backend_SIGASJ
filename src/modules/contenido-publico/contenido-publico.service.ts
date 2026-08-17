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

  getContacto() {
    return {
      telefono: '+506 2680-0000',
      email: 'info@asadasanjuan.cr',
      direccion: 'San Juan de Santa Cruz, Guanacaste, Costa Rica',
      horarioAtencion: 'Lunes a Viernes: 8:00 AM - 4:00 PM',
    };
  }

  getGaleria() {
    return [
      {
        id: 1,
        titulo: 'Tanque Principal',
        url: '/images/tanque.jpg',
        activa: true,
      },
      {
        id: 2,
        titulo: 'Oficina Central',
        url: '/images/oficina.jpg',
        activa: true,
      },
    ];
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
