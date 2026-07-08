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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovimientosController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const confirm_password_dto_1 = require("./dto/confirm-password.dto");
const create_movimiento_dto_1 = require("./dto/create-movimiento.dto");
const update_movimiento_dto_1 = require("./dto/update-movimiento.dto");
const movimientos_service_1 = require("./movimientos.service");
let MovimientosController = class MovimientosController {
    constructor(movimientosService) {
        this.movimientosService = movimientosService;
    }
    findAll(user, from, to, tipo) {
        return this.movimientosService.findAll(this.requireIglesiaId(user), from ? new Date(from) : undefined, to ? new Date(to) : undefined, tipo);
    }
    dashboard(user, from, to) {
        return this.movimientosService.dashboard(this.requireIglesiaId(user), from ? new Date(from) : undefined, to ? new Date(to) : undefined);
    }
    logs(user) {
        return this.movimientosService.logs(this.requireIglesiaId(user));
    }
    async exportar(user, res, from, to) {
        const buffer = await this.movimientosService.exportar(this.requireIglesiaId(user), from ? new Date(from) : undefined, to ? new Date(to) : undefined);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="movimientos.xlsx"',
        });
        return new common_1.StreamableFile(buffer);
    }
    create(user, dto) {
        return this.movimientosService.create(this.requireIglesiaId(user), user.sub, dto);
    }
    update(user, id, dto) {
        return this.movimientosService.update(this.requireIglesiaId(user), id, user.sub, dto);
    }
    remove(user, id, dto) {
        return this.movimientosService.remove(this.requireIglesiaId(user), id, user.sub, dto);
    }
    requireIglesiaId(user) {
        if (!user.iglesiaId) {
            throw new common_1.ForbiddenException('El usuario no tiene una iglesia asociada');
        }
        return user.iglesiaId;
    }
};
exports.MovimientosController = MovimientosController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('tipo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], MovimientosController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], MovimientosController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('logs'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MovimientosController.prototype, "logs", null);
__decorate([
    (0, common_1.Get)('exportar'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], MovimientosController.prototype, "exportar", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_movimiento_dto_1.CreateMovimientoDto]),
    __metadata("design:returntype", void 0)
], MovimientosController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_movimiento_dto_1.UpdateMovimientoDto]),
    __metadata("design:returntype", void 0)
], MovimientosController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, confirm_password_dto_1.ConfirmPasswordDto]),
    __metadata("design:returntype", Promise)
], MovimientosController.prototype, "remove", null);
exports.MovimientosController = MovimientosController = __decorate([
    (0, common_1.Controller)('finanzas/movimientos'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Rol.PASTOR, client_1.Rol.TESORERO),
    __metadata("design:paramtypes", [movimientos_service_1.MovimientosService])
], MovimientosController);
//# sourceMappingURL=movimientos.controller.js.map