import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Rol } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Fase 7 de docs/supabase.md, en modo "convivencia temporal": espeja usuarios
 * hacia `auth.users` de un proyecto de Supabase separado, dedicado solo a
 * probar Auth (`Backend-auth-test`), NUNCA el proyecto real que ya usa
 * SupabaseStorageService para Storage. El login real de la plataforma sigue
 * siendo 100% JWT/bcrypt propio (ver AuthService) — este servicio no participa
 * en la decisión de autenticar a nadie, solo mantiene un espejo para poder
 * probar el flujo de punta a punta sin arriesgar sesiones reales.
 *
 * Deliberadamente tolerante a no estar configurado: `SUPABASE_AUTH_TEST_URL`/
 * `SUPABASE_AUTH_TEST_SERVICE_ROLE_KEY` son opcionales (a diferencia de
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY de Storage, que si son obligatorios).
 * Sin ellas, `mirrorUsuario` es un no-op silencioso — así el resto del equipo
 * sigue pudiendo correr el backend local sin tener que crear una cuenta de
 * prueba de Supabase Auth solo para levantar el server.
 */
@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);
  private readonly client: SupabaseClient | null;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const url = config.get<string>('SUPABASE_AUTH_TEST_URL');
    const serviceRoleKey = config.get<string>('SUPABASE_AUTH_TEST_SERVICE_ROLE_KEY');

    this.client =
      url && serviceRoleKey ? createClient(url, serviceRoleKey, { auth: { persistSession: false } }) : null;

    if (!this.client) {
      this.logger.warn(
        'SUPABASE_AUTH_TEST_URL/SUPABASE_AUTH_TEST_SERVICE_ROLE_KEY no configuradas — el espejo a Supabase Auth queda desactivado (Fase 7 en pausa en este entorno).',
      );
    }
  }

  /**
   * Best-effort y no bloqueante: se llama sin `await` desde
   * AuthService#validateUser, justo después de validar la contraseña (es el
   * único momento en que el backend tiene el password en texto plano — nunca
   * se persiste, solo viaja a la API de admin de Supabase Auth por HTTPS para
   * crear el usuario espejo). Si esto falla, el login real NO se ve afectado
   * en absoluto: solo se reintenta en el próximo login mientras
   * `supabaseUserId` siga null.
   */
  async mirrorUsuario(
    usuario: { id: string; email: string; rol: Rol; iglesiaId: string | null; supabaseUserId: string | null },
    password: string,
  ): Promise<void> {
    if (!this.client || usuario.supabaseUserId) {
      return;
    }

    const { data, error } = await this.client.auth.admin.createUser({
      email: usuario.email,
      password,
      email_confirm: true,
      app_metadata: { usuarioId: usuario.id, rol: usuario.rol, iglesiaId: usuario.iglesiaId },
    });

    if (error || !data.user) {
      throw new Error(error?.message ?? 'Supabase Auth no devolvió un usuario creado');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { supabaseUserId: data.user.id },
    });
  }
}
