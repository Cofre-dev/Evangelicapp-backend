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
exports.IglesiasController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const create_iglesia_dto_1 = require("./dto/create-iglesia.dto");
const iglesias_service_1 = require("./iglesias.service");
const logo_upload_config_1 = require("./logo-upload.config");
let IglesiasController = class IglesiasController {
    constructor(iglesiasService) {
        this.iglesiasService = iglesiasService;
    }
    create(dto, logo) {
        return this.iglesiasService.create(dto, logo);
    }
    findOne(id) {
        return this.iglesiasService.findOne(id);
    }
};
exports.IglesiasController = IglesiasController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('logo', logo_upload_config_1.logoMulterOptions)),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_iglesia_dto_1.CreateIglesiaDto, Object]),
    __metadata("design:returntype", void 0)
], IglesiasController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], IglesiasController.prototype, "findOne", null);
exports.IglesiasController = IglesiasController = __decorate([
    (0, common_1.Controller)('iglesias'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Rol.SUPER_ADMIN),
    __metadata("design:paramtypes", [iglesias_service_1.IglesiasService])
], IglesiasController);
//# sourceMappingURL=iglesias.controller.js.map