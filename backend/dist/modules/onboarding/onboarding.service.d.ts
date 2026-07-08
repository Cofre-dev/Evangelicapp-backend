import { AuthService, SafeUsuario } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
export declare class OnboardingService {
    private readonly prisma;
    private readonly authService;
    constructor(prisma: PrismaService, authService: AuthService);
    complete(usuarioId: string, iglesiaId: string, dto: CompleteOnboardingDto): Promise<SafeUsuario & {
        requiresPasswordChange: boolean;
        requiresOnboarding: boolean;
    }>;
}
