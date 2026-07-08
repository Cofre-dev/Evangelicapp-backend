declare const ROLES_ASIGNABLES: readonly ["TESORERO", "SECRETARIA"];
export declare class UpdateUsuarioDto {
    nombre?: string;
    apellido?: string;
    telefono?: string;
    rol?: (typeof ROLES_ASIGNABLES)[number];
    activo?: boolean;
}
export {};
