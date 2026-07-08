import { PrismaService } from '../../prisma/prisma.service';
import { CreateIglesiaDto } from './dto/create-iglesia.dto';
export declare class IglesiasService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateIglesiaDto, logo?: Express.Multer.File): Promise<{
        iglesia: {
            nombre: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            logoUrl: string | null;
            comuna: string;
            region: string;
            direccion: string | null;
            estado: import(".prisma/client").$Enums.EstadoIglesia;
            visitantesPromedio: number | null;
        };
        pastor: {
            email: string;
            nombre: string;
            id: string;
            username: string;
            apellido: string;
        };
        temporaryPassword: string;
    }>;
    findOne(id: string): Promise<{
        pastor: {
            email: string;
            nombre: string;
            id: string;
            createdAt: Date;
            username: string;
            apellido: string;
            rol: import(".prisma/client").$Enums.Rol;
            activo: boolean;
        } | null;
        equipo: {
            email: string;
            nombre: string;
            id: string;
            createdAt: Date;
            username: string;
            apellido: string;
            rol: import(".prisma/client").$Enums.Rol;
            activo: boolean;
        }[];
        nombre: string;
        id: string;
        createdAt: Date;
        logoUrl: string | null;
        comuna: string;
        region: string;
        direccion: string | null;
        estado: import(".prisma/client").$Enums.EstadoIglesia;
        visitantesPromedio: number | null;
    }>;
}
