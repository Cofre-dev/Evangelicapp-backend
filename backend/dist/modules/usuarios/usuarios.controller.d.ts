import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';
export declare class UsuariosController {
    private readonly usuariosService;
    constructor(usuariosService: UsuariosService);
    findAll(user: JwtPayload): Promise<{
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
    create(user: JwtPayload, dto: CreateUsuarioDto): Promise<{
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
    update(user: JwtPayload, id: string, dto: UpdateUsuarioDto): Promise<{
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
    private requireIglesiaId;
}
