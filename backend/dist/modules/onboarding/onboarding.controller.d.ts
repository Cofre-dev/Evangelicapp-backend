import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { OnboardingService } from './onboarding.service';
export declare class OnboardingController {
    private readonly onboardingService;
    constructor(onboardingService: OnboardingService);
    complete(user: JwtPayload, dto: CompleteOnboardingDto): Promise<Omit<{
        email: string;
        nombre: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        iglesiaId: string | null;
        username: string;
        password: string;
        apellido: string;
        telefono: string | null;
        rol: import(".prisma/client").$Enums.Rol;
        mustChangePassword: boolean;
        onboardingCompletado: boolean;
        activo: boolean;
    }, "password"> & {
        iglesia: {
            nombre: string;
            logoUrl: string | null;
        } | null;
    } & {
        requiresPasswordChange: boolean;
        requiresOnboarding: boolean;
    }>;
}
