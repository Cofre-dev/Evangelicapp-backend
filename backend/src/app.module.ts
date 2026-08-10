import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { RefreshOriginMiddleware } from './common/middleware/refresh-origin.middleware';
import { AccesosModule } from './modules/accesos/accesos.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { AuthModule } from './modules/auth/auth.module';
import { CeremoniasModule } from './modules/ceremonias/ceremonias.module';
import { FinanzasModule } from './modules/finanzas/finanzas.module';
import { IglesiasModule } from './modules/iglesias/iglesias.module';
import { IntegrantesModule } from './modules/integrantes/integrantes.module';
import { MiIglesiaModule } from './modules/mi-iglesia/mi-iglesia.module';
import { NotasModule } from './modules/notas/notas.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    OnboardingModule,
    UsuariosModule,
    AccesosModule,
    SuperAdminModule,
    IglesiasModule,
    MiIglesiaModule,
    AgendaModule,
    FinanzasModule,
    NotasModule,
    IntegrantesModule,
    CeremoniasModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CsrfMiddleware)
      .exclude(
        // Login: todavía no hay sesión/cookie que proteger.
        { path: 'auth/login', method: RequestMethod.POST },
        // Confirmación pública de predicadores: el token de un solo uso es la propia
        // autenticación; no depende de cookies de sesión (ver PredicadoresController).
        { path: 'agenda/predicadores/:token/responder', method: RequestMethod.POST },
        // RSVP público de integrantes a un evento (convocatoria por email): mismo caso
        // que la confirmación de predicadores — el token de un solo uso es la propia
        // autenticación (ver AsistenciasController).
        { path: 'agenda/asistencias/:token/responder', method: RequestMethod.POST },
        // Registro público de integrantes por QR: mismo caso — si un Pastor/Secretaria
        // logueado abre la landing en el mismo navegador, su cookie de sesión no debe
        // exigir el header CSRF que esa landing pública nunca envía.
        { path: 'integrantes/registro/:qrToken', method: RequestMethod.POST },
        // Refresh: es el endpoint que le da al frontend un csrfToken nuevo cuando perdió
        // el que tenía en memoria (ej. tras un F5) — exigirle CSRF para conseguir el
        // primer csrfToken es un candado que pide su propia llave. A diferencia de
        // auth/login, acá SÍ hay una cookie de sesión (refresh_token) que un atacante
        // cross-site puede lograr que viaje (SameSite=None en producción, ver
        // cookies.ts), así que esta exclusión por sí sola no basta — por eso se
        // complementa con RefreshOriginMiddleware más abajo, que exige que el header
        // Origin coincida con CORS_ORIGIN (no falsificable por el navegador).
        { path: 'auth/refresh', method: RequestMethod.POST },
      )
      .forRoutes('*');

    // Ver comentario en refresh-origin.middleware.ts: cierra el hueco que deja la
    // exclusión de CSRF de arriba para este único endpoint (blind CSRF vía
    // SameSite=None podía forzar una rotación no solicitada y, en el peor caso,
    // un logout global de la víctima por la detección de reuso de refresh token).
    consumer.apply(RefreshOriginMiddleware).forRoutes({ path: 'auth/refresh', method: RequestMethod.POST });
  }
}
