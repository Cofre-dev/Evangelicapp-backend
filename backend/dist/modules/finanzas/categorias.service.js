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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriasService = void 0;
const common_1 = require("@nestjs/common");
const translate_unique_constraint_error_1 = require("../../common/utils/translate-unique-constraint-error");
const prisma_service_1 = require("../../prisma/prisma.service");
let CategoriasService = class CategoriasService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(iglesiaId, tipo) {
        return this.prisma.categoriaFinanciera.findMany({
            where: { iglesiaId, ...(tipo ? { tipo } : {}) },
            orderBy: { nombre: 'asc' },
        });
    }
    async create(iglesiaId, dto) {
        try {
            return await this.prisma.categoriaFinanciera.create({
                data: { nombre: dto.nombre, tipo: dto.tipo, iglesiaId },
            });
        }
        catch (error) {
            throw (0, translate_unique_constraint_error_1.translateUniqueConstraintError)(error);
        }
    }
};
exports.CategoriasService = CategoriasService;
exports.CategoriasService = CategoriasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CategoriasService);
//# sourceMappingURL=categorias.service.js.map