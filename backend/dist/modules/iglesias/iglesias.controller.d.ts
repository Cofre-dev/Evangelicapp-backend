import { CreateIglesiaDto } from './dto/create-iglesia.dto';
import { IglesiasService } from './iglesias.service';
export declare class IglesiasController {
    private readonly iglesiasService;
    constructor(iglesiasService: IglesiasService);
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
