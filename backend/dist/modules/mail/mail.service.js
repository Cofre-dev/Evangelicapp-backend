"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer = __importStar(require("nodemailer"));
let MailService = MailService_1 = class MailService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(MailService_1.name);
        this.transporter = nodemailer.createTransport({
            host: this.config.get('SMTP_HOST', 'localhost'),
            port: this.config.get('SMTP_PORT', 1025),
            secure: false,
        });
    }
    async enviarInvitacionPredicador(params) {
        const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
        const link = `${frontendUrl}/predicacion/${params.tokenConfirmacion}`;
        const fechaTexto = params.fecha.toLocaleDateString('es-CL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
        try {
            await this.transporter.sendMail({
                from: this.config.get('MAIL_FROM', '"Evangelicapp" <noreply@evangelicapp.cl>'),
                to: params.email,
                subject: `Invitación a predicar — ${params.nombreIglesia}`,
                html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0369a1;">${params.nombreIglesia}</h2>
            <p>Has sido invitado a predicar en <strong>${params.tituloEvento}</strong>.</p>
            <p>Fecha: ${fechaTexto}</p>
            <p style="margin-top: 24px;">
              <a href="${link}" style="background:#38bdf8;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Responder invitación
              </a>
            </p>
          </div>
        `,
            });
        }
        catch (error) {
            this.logger.error(`No se pudo enviar la invitación a ${params.email}`, error);
        }
    }
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map