declare const ROLES_ASIGNABLES: readonly ["TESORERO", "SECRETARIA"];
export declare class CreateUsuarioDto {
    username: string;
    email: string;
    nombre: string;
    apellido: string;
    telefono?: string;
    rol: (typeof ROLES_ASIGNABLES)[number];
}
export {};
