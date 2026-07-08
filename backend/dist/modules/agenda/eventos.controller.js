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
exports.EventosController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const create_evento_dto_1 = require("./dto/create-evento.dto");
const update_evento_dto_1 = require("./dto/update-evento.dto");
const eventos_service_1 = require("./eventos.service");
let EventosController = class EventosController {
    constructor(eventosService) {
        this.eventosService = eventosService;
    }
    findAll(user, from, to) {
        return this.eventosService.findAll(this.requireIglesiaId(user), from ? new Date(from) : undefined, to ? new Date(to) : undefined);
    }
    findOne(user, id) {
        return this.eventosService.findOne(this.requireIglesiaId(user), id);
    }
    create(user, dto) {
        return this.eventosService.create(this.requireIglesiaId(user), user.sub, dto);
    }
    update(user, id, dto) {
        return this.eventosService.update(this.requireIglesiaId(user), id, dto);
    }
    remove(user, id) {
        return this.eventosService.remove(this.requireIglesiaId(user), id);
    }
    requireIglesiaId(user) {
        if (!user.iglesiaId) {
            throw new common_1.ForbiddenException('El usuario no tiene una iglesia asociada');
        }
        return user.iglesiaId;
    }
};
exports.EventosController = EventosController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], EventosController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EventosController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_evento_dto_1.CreateEventoDto]),
    __metadata("design:returntype", void 0)
], EventosController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_evento_dto_1.UpdateEventoDto]),
    __metadata("design:returntype", void 0)
], EventosController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EventosController.prototype, "remove", null);
exports.EventosController = EventosController = __decorate([
    (0, common_1.Controller)('agenda/eventos'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Rol.PASTOR, client_1.Rol.TESORERO, client_1.Rol.SECRETARIA),
    __metadata("design:paramtypes", [eventos_service_1.EventosService])
], EventosController);
//# sourceMappingURL=eventos.controller.js.map