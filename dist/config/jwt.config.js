"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('jwt', () => ({
    secret: process.env.JWT_SECRET || 'super_secret_jwt_key_sigasj_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
}));
//# sourceMappingURL=jwt.config.js.map