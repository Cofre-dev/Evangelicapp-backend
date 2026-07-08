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
exports.NotasController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const create_nota_dto_1 = require("./dto/create-nota.dto");
const update_nota_dto_1 = require("./dto/update-nota.dto");
const notas_service_1 = require("./notas.service");
let NotasController = class NotasController {
    constructor(notasService) {
        this.notasService = notasService;
    }
    findAll(user) {
        return this.notasService.findAll(this.requireIglesiaId(user));
    }
    findMisTareas(user) {
        return this.notasService.findMisTareas(this.requireIglesiaId(user), user.sub);
    }
    create(user, dto) {
        return this.notasService.create(this.requireIglesiaId(user), user.sub, dto);
    }
    update(user, id, dto) {
        return this.notasService.update(this.requireIglesiaId(user), id, dto);
    }
    marcarHecha(user, id) {
        return this.notasService.marcarHecha(this.requireIglesiaId(user), user.sub, id);
    }
    remove(user, id) {
        return this.notasService.remove(this.requireIglesiaId(user), id);
    }
    requireIglesiaId(user) {
        if (!user.iglesiaId) {
            throw new common_1.ForbiddenException('El usuario no tiene una iglesia asociada');
        }
        return user.iglesiaId;
    }
};
exports.NotasController = NotasController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotasController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('mis-tareas'),
    (0, roles_decorator_1.Roles)(client_1.Rol.PASTOR, client_1.Rol.TESORERO, client_1.Rol.SECRETARIA),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotasController.prototype, "findMisTareas", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_nota_dto_1.CreateNotaDto]),
    __metadata("design:returntype", void 0)
], NotasController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_nota_dto_1.UpdateNotaDto]),
    __metadata("design:returntype", void 0)
], NotasController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/marcar-hecha'),
    (0, roles_decorator_1.Roles)(client_1.Rol.PASTOR, client_1.Rol.TESORERO, client_1.Rol.SECRETARIA),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], NotasController.prototype, "marcarHecha", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NotasController.prototype, "remove", null);
exports.NotasController = NotasController = __decorate([
    (0, common_1.Controller)('notas'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Rol.PASTOR),
    __metadata("design:paramtypes", [notas_service_1.NotasService])
], NotasController);
//# sourceMappingURL=notas.controller.js.map