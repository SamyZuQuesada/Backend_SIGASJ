"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComunicadosService = void 0;
const common_1 = require("@nestjs/common");
let ComunicadosService = class ComunicadosService {
    comunicados = [
        {
            id: '1',
            titulo: 'Mantenimiento Programado de Red de Agua',
            descripcion: 'Se realizará suspensión temporal del servicio por reparaciones en el sector principal.',
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
            descripcion: 'Invitación a todos los abonados a la asamblea anual de la ASADA San Juan.',
            tipo: 'Informativo',
            prioridad: 'Media',
            estado: 'Activo',
            esPublico: true,
            fechaPublicacion: new Date().toISOString(),
            fechaExpiracion: null,
        },
    ];
    findPublicos() {
        return this.comunicados.filter((c) => c.estado === 'Activo' && c.esPublico);
    }
    findAllAdmin() {
        return this.comunicados;
    }
    findOne(id) {
        const comunicado = this.comunicados.find((c) => c.id === id);
        if (!comunicado) {
            throw new common_1.NotFoundException(`Comunicado con ID ${id} no encontrado`);
        }
        return comunicado;
    }
};
exports.ComunicadosService = ComunicadosService;
exports.ComunicadosService = ComunicadosService = __decorate([
    (0, common_1.Injectable)()
], ComunicadosService);
//# sourceMappingURL=comunicados.service.js.map