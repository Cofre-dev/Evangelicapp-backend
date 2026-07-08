"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgendaModule = void 0;
const common_1 = require("@nestjs/common");
const mail_module_1 = require("../mail/mail.module");
const eventos_controller_1 = require("./eventos.controller");
const eventos_service_1 = require("./eventos.service");
const predicadores_controller_1 = require("./predicadores.controller");
const predicadores_service_1 = require("./predicadores.service");
let AgendaModule = class AgendaModule {
};
exports.AgendaModule = AgendaModule;
exports.AgendaModule = AgendaModule = __decorate([
    (0, common_1.Module)({
        imports: [mail_module_1.MailModule],
        controllers: [eventos_controller_1.EventosController, predicadores_controller_1.PredicadoresController],
        providers: [eventos_service_1.EventosService, predicadores_service_1.PredicadoresService],
    })
], AgendaModule);
//# sourceMappingURL=agenda.module.js.map