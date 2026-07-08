import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgendaModule } from './modules/agenda/agenda.module';
import { AuthModule } from './modules/auth/auth.module';
import { FinanzasModule } from './modules/finanzas/finanzas.module';
import { IglesiasModule } from './modules/iglesias/iglesias.module';
import { NotasModule } from './modules/notas/notas.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OnboardingModule,
    UsuariosModule,
    SuperAdminModule,
    IglesiasModule,
    AgendaModule,
    FinanzasModule,
    NotasModule,
  ],
})
export class AppModule {}
