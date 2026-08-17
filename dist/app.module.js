"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const environment_config_1 = __importDefault(require("./config/environment.config"));
const database_config_1 = __importDefault(require("./config/database.config"));
const jwt_config_1 = __importDefault(require("./config/jwt.config"));
const auth_module_1 = require("./modules/auth/auth.module");
const usuarios_module_1 = require("./modules/usuarios/usuarios.module");
const contenido_publico_module_1 = require("./modules/contenido-publico/contenido-publico.module");
const comunicados_module_1 = require("./modules/comunicados/comunicados.module");
const abonados_module_1 = require("./modules/abonados/abonados.module");
const averias_module_1 = require("./modules/averias/averias.module");
const solicitudes_module_1 = require("./modules/solicitudes/solicitudes.module");
const lecturas_module_1 = require("./modules/lecturas/lecturas.module");
const consumos_module_1 = require("./modules/consumos/consumos.module");
const inventario_module_1 = require("./modules/inventario/inventario.module");
const actividades_fontanero_module_1 = require("./modules/actividades-fontanero/actividades-fontanero.module");
const proyectos_module_1 = require("./modules/proyectos/proyectos.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [environment_config_1.default, database_config_1.default, jwt_config_1.default],
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => configService.get('database'),
            }),
            auth_module_1.AuthModule,
            usuarios_module_1.UsuariosModule,
            contenido_publico_module_1.ContenidoPublicoModule,
            comunicados_module_1.ComunicadosModule,
            abonados_module_1.AbonadosModule,
            averias_module_1.AveriasModule,
            solicitudes_module_1.SolicitudesModule,
            lecturas_module_1.LecturasModule,
            consumos_module_1.ConsumosModule,
            inventario_module_1.InventarioModule,
            actividades_fontanero_module_1.ActividadesFontaneroModule,
            proyectos_module_1.ProyectosModule,
        ],
        controllers: [],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map