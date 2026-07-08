import { PrismaService } from '../../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
export declare class UsuariosService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAllForIglesia(iglesiaId: string): Promise<{
        email: string;
        nombre: string;
        id: string;
        createdAt: Date;
        username: string;
        apellido: string;
        telefono: string | null;
        rol: import(".prisma/client").$Enums.Rol;
        mustChangePassword: boolean;
        activo: boolean;
    }[]>;
    create(iglesiaId: string, dto: CreateUsuarioDto): Promise<{
        usuario: {
            email: string;
            nombre: string;
            id: string;
            createdAt: Date;
            username: string;
            apellido: string;
            telefono: string | null;
            rol: import(".prisma/client").$Enums.Rol;
            mustChangePassword: boolean;
            activo: boolean;
        };
        temporaryPassword: string;
    }>;
    update(iglesiaId: string, usuarioId: string, dto: UpdateUsuarioDto): Promise<{
        email: string;
        nombre: string;
        id: string;
        createdAt: Date;
        username: string;
        apellido: string;
        telefono: string | null;
        rol: import(".prisma/client").$Enums.Rol;
        mustChangePassword: boolean;
        activo: boolean;
    }>;
    private findMiembroEquipoOrThrow;
}
