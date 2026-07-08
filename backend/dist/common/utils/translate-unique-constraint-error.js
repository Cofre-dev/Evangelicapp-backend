"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateUniqueConstraintError = translateUniqueConstraintError;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
function translateUniqueConstraintError(error) {
    if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        return error;
    }
    const target = error.meta?.target;
    const targetStr = Array.isArray(target) ? target.join(',') : String(target ?? '');
    if (targetStr.includes('username')) {
        return new common_1.ConflictException('Ese nombre de usuario ya está en uso');
    }
    if (targetStr.includes('email')) {
        return new common_1.ConflictException('Ya existe una cuenta con ese correo');
    }
    return new common_1.ConflictException('Ya existe un registro con ese valor');
}
//# sourceMappingURL=translate-unique-constraint-error.js.map