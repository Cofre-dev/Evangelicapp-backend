import { ConfigService } from '@nestjs/config';
interface InvitacionPredicadorParams {
    email: string;
    nombreIglesia: string;
    tituloEvento: string;
    fecha: Date;
    tokenConfirmacion: string;
}
export declare class MailService {
    private readonly config;
    private readonly logger;
    private readonly transporter;
    constructor(config: ConfigService);
    enviarInvitacionPredicador(params: InvitacionPredicadorParams): Promise<void>;
}
export {};
