"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContenidoPublicoService = void 0;
const common_1 = require("@nestjs/common");
let ContenidoPublicoService = class ContenidoPublicoService {
    getInformacionInstitucional() {
        return {
            asada: 'ASADA San Juan',
            ubicacion: 'Santa Cruz, Guanacaste, Costa Rica',
            mision: 'Proveer agua potable con calidad, continuidad y compromiso con la comunidad.',
            vision: 'Ser una ASADA modelo en gestión comunitaria e infraestructura hídrica.',
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
};
exports.ContenidoPublicoService = ContenidoPublicoService;
exports.ContenidoPublicoService = ContenidoPublicoService = __decorate([
    (0, common_1.Injectable)()
], ContenidoPublicoService);
//# sourceMappingURL=contenido-publico.service.js.map