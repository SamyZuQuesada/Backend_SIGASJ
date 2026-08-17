"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContenidoPublicoController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const contenido_publico_service_1 = require("./contenido-publico.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const role_enum_1 = require("../../common/enums/role.enum");
let ContenidoPublicoController = class ContenidoPublicoController {
    contenidoPublicoService;
    constructor(contenidoPublicoService) {
        this.contenidoPublicoService = contenidoPublicoService;
    }
    getPublicInformacion() {
        return this.contenidoPublicoService.getInformacionInstitucional();
    }
    getPublicContacto() {
        return this.contenidoPublicoService.getContacto();
    }
    getPublicGaleria() {
        return this.contenidoPublicoService.getGaleria();
    }
    getPublicTransparencia() {
        return this.contenidoPublicoService.getTransparencia();
    }
    getAdminInformacion() {
        return this.contenidoPublicoService.getInformacionInstitucional();
    }
    getAdminContacto() {
        return this.contenidoPublicoService.getContacto();
    }
};
exports.ContenidoPublicoController = ContenidoPublicoController;
__decorate([
    (0, common_1.Get)('public/informacion'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener información institucional (Público)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ContenidoPublicoController.prototype, "getPublicInformacion", null);
__decorate([
    (0, common_1.Get)('public/contacto'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obtener información de contacto y ubicación (Público)',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ContenidoPublicoController.prototype, "getPublicContacto", null);
__decorate([
    (0, common_1.Get)('public/galeria'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener galería de fotografías (Público)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ContenidoPublicoController.prototype, "getPublicGaleria", null);
__decorate([
    (0, common_1.Get)('public/transparencia'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener documentos de transparencia (Público)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ContenidoPublicoController.prototype, "getPublicTransparencia", null);
__decorate([
    (0, common_1.Get)('admin/informacion'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.ADMINISTRADORA, role_enum_1.Role.SECRETARIA),
    (0, swagger_1.ApiOperation)({
        summary: 'Consultar información institucional para edición (Admin)',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ContenidoPublicoController.prototype, "getAdminInformacion", null);
__decorate([
    (0, common_1.Get)('admin/contacto'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.ADMINISTRADORA, role_enum_1.Role.SECRETARIA),
    (0, swagger_1.ApiOperation)({ summary: 'Consultar datos de contacto para edición (Admin)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ContenidoPublicoController.prototype, "getAdminContacto", null);
exports.ContenidoPublicoController = ContenidoPublicoController = __decorate([
    (0, swagger_1.ApiTags)('Contenido Público (Landing Page)'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [contenido_publico_service_1.ContenidoPublicoService])
], ContenidoPublicoController);
//# sourceMappingURL=contenido-publico.controller.js.map