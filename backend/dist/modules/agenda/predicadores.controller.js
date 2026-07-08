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
exports.PredicadoresController = void 0;
const common_1 = require("@nestjs/common");
const responder_predicador_dto_1 = require("./dto/responder-predicador.dto");
const predicadores_service_1 = require("./predicadores.service");
let PredicadoresController = class PredicadoresController {
    constructor(predicadoresService) {
        this.predicadoresService = predicadoresService;
    }
    getInvitacion(token) {
        return this.predicadoresService.getInvitacion(token);
    }
    responder(token, dto) {
        return this.predicadoresService.responder(token, dto.respuesta);
    }
};
exports.PredicadoresController = PredicadoresController;
__decorate([
    (0, common_1.Get)(':token'),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PredicadoresController.prototype, "getInvitacion", null);
__decorate([
    (0, common_1.Post)(':token/responder'),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, responder_predicador_dto_1.ResponderPredicadorDto]),
    __metadata("design:returntype", void 0)
], PredicadoresController.prototype, "responder", null);
exports.PredicadoresController = PredicadoresController = __decorate([
    (0, common_1.Controller)('agenda/predicadores'),
    __metadata("design:paramtypes", [predicadores_service_1.PredicadoresService])
], PredicadoresController);
//# sourceMappingURL=predicadores.controller.js.map