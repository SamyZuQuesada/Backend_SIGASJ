"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContenidoPublicoModule = void 0;
const common_1 = require("@nestjs/common");
const contenido_publico_service_1 = require("./contenido-publico.service");
const contenido_publico_controller_1 = require("./contenido-publico.controller");
let ContenidoPublicoModule = class ContenidoPublicoModule {
};
exports.ContenidoPublicoModule = ContenidoPublicoModule;
exports.ContenidoPublicoModule = ContenidoPublicoModule = __decorate([
    (0, common_1.Module)({
        controllers: [contenido_publico_controller_1.ContenidoPublicoController],
        providers: [contenido_publico_service_1.ContenidoPublicoService],
        exports: [contenido_publico_service_1.ContenidoPublicoService],
    })
], ContenidoPublicoModule);
//# sourceMappingURL=contenido-publico.module.js.map