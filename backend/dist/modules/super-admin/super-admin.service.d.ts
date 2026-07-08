import { EstadoIglesia } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
export interface DashboardResponse {
    totales: {
        iglesias: number;
        iglesiasActivas: number;
        pastores: number;
    };
    porRegion: {
        region: string;
        cantidad: number;
    }[];
    iglesias: {
        id: string;
        nombre: string;
        comuna: string;
        region: string;
        logoUrl: string | null;
        estado: EstadoIglesia;
        createdAt: Date;
        pastor: {
            nombre: string;
            apellido: string;
            email: string;
        } | null;
    }[];
}
export declare class SuperAdminService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getDashboard(): Promise<DashboardResponse>;
}
