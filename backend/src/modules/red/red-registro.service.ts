import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrigenIglesia, PlanIglesia, Prisma, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { BCRYPT_ROUNDS } from '../../common/constants/bcrypt';
import { resolverComuna } from '../../common/constants/chile-regiones';
import { runAsService } from '../../common/context/tenant-context';
import { generateSecureToken } from '../../common/utils/generate-secure-token';
import { translateUniqueConstraintError } from '../../common/utils/translate-unique-constraint-error';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RealtimeService } from '../realtime/realtime.service';
import { RegistroIglesiaDto } from './dto/registro-iglesia.dto';
import { sincronizarPerfilRed } from './perfil-red.sync';

const HORAS_VALIDEZ_LINK = 24;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Lo que se guarda en `SolicitudRegistroIglesia.datos` (nunca la contraseña en claro). */
interface DatosRegistro {
  nombreIglesia: string;
  region: string;
  comuna: string;
  direccion: string | null;
  pastorNombre: string;
  pastorApellido: string;
  email: string;
  username: string;
  telefono: string | null;
  passwordHash: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Registro autoservicio de iglesias (plan GRATUITO): cualquier iglesia puede entrar a la
 * Red de iglesias sin pasar por el SuperAdmin.
 *
 * Dos pasos, ambos públicos y bajo `runAsService` (no hay identidad todavía):
 *   1. `solicitar`: valida, guarda una SolicitudRegistroIglesia (contraseña ya hasheada)
 *      y manda un link de confirmación al correo. No crea nada más.
 *   2. `confirmar`: con el token del link crea, en una sola transacción, la iglesia
 *      (GRATUITO, AUTOSERVICIO, sin verificar, sin facturación), su pastor MANAGER y su
 *      perfil en la red (visible en el directorio).
 * Después el pastor inicia sesión normal (el espejo en Supabase Auth se crea perezoso en
 * el primer login, igual que para el resto de usuarios) y pasa por el onboarding.
 */
@Injectable()
export class RedRegistroService {
  private readonly logger = new Logger(RedRegistroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly realtimeService: RealtimeService,
  ) {}

  async solicitar(dto: RegistroIglesiaDto, ip?: string) {
    await this.verificarCaptcha(dto.turnstileToken, ip);

    const ubicacion = resolverComuna(dto.region, dto.comuna);
    if (!ubicacion) {
      throw new BadRequestException('La comuna no existe o no pertenece a la región indicada');
    }

    return runAsService(async () => {
      await this.verificarDisponibles(dto.email, dto.username);

      const datos: DatosRegistro = {
        nombreIglesia: dto.nombreIglesia,
        region: ubicacion.region,
        comuna: ubicacion.comuna,
        direccion: dto.direccion || null,
        pastorNombre: dto.pastorNombre,
        pastorApellido: dto.pastorApellido,
        email: dto.email,
        username: dto.username,
        telefono: dto.telefono || null,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      };

      const token = generateSecureToken();
      await this.prisma.solicitudRegistroIglesia.create({
        data: {
          tokenHash: hashToken(token),
          email: dto.email,
          datos: datos as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + HORAS_VALIDEZ_LINK * 60 * 60 * 1000),
        },
      });

      await this.mailService.enviarConfirmacionRegistro({
        email: dto.email,
        nombre: dto.pastorNombre,
        nombreIglesia: dto.nombreIglesia,
        token,
        expiraEnHoras: HORAS_VALIDEZ_LINK,
      });

      return { email: dto.email, expiraEnHoras: HORAS_VALIDEZ_LINK };
    });
  }

  async confirmar(token: string) {
    return runAsService(async () => {
      const solicitud = await this.prisma.solicitudRegistroIglesia.findUnique({
        where: { tokenHash: hashToken(token) },
      });
      if (!solicitud) {
        throw new NotFoundException('El enlace de confirmación no es válido');
      }
      const datos = solicitud.datos as unknown as DatosRegistro;

      // Idempotente: abrir el link dos veces (o un doble clic) no es un error.
      if (solicitud.confirmadaEn) {
        return { estado: 'YA_CONFIRMADA' as const, email: datos.email, username: datos.username };
      }
      if (solicitud.expiresAt.getTime() < Date.now()) {
        throw new GoneException('El enlace de confirmación venció. Vuelve a registrar tu iglesia.');
      }

      try {
        const iglesia = await this.prisma.withTenantTransaction(async (tx) => {
          const iglesia = await tx.iglesia.create({
            data: {
              nombre: datos.nombreIglesia,
              region: datos.region,
              comuna: datos.comuna,
              direccion: datos.direccion,
              plan: PlanIglesia.GRATUITO,
              origen: OrigenIglesia.AUTOSERVICIO,
              verificada: false,
              proximaFacturacion: null,
            },
            select: { id: true, nombre: true, comuna: true, region: true },
          });

          await tx.usuario.create({
            data: {
              username: datos.username,
              email: datos.email,
              password: datos.passwordHash,
              nombre: datos.pastorNombre,
              apellido: datos.pastorApellido,
              telefono: datos.telefono,
              rol: Rol.MANAGER,
              iglesiaId: iglesia.id,
              // Eligió su propia contraseña: no hay credencial temporal que cambiar.
              mustChangePassword: false,
              onboardingCompletado: false,
            },
          });

          await sincronizarPerfilRed(tx, iglesia.id, true);
          await tx.solicitudRegistroIglesia.update({
            where: { id: solicitud.id },
            data: { confirmadaEn: new Date() },
          });
          return iglesia;
        });

        this.realtimeService.emitASuperAdmin('iglesia:registrada', iglesia);
        return { estado: 'CONFIRMADA' as const, email: datos.email, username: datos.username };
      } catch (error) {
        throw translateUniqueConstraintError(error);
      }
    });
  }

  private async verificarDisponibles(email: string, username: string): Promise<void> {
    const existentes = await this.prisma.usuario.findMany({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (existentes.some((u) => u.email === email)) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }
    if (existentes.some((u) => u.username === username)) {
      throw new ConflictException('Ese nombre de usuario ya está en uso');
    }
  }

  /**
   * Cloudflare Turnstile contra bots. Si `TURNSTILE_SECRET_KEY` no está configurada (dev
   * local, tests) se omite con un aviso en el log; en producción tiene que estar.
   */
  private async verificarCaptcha(token: string | undefined, ip?: string): Promise<void> {
    const secret = this.config.get<string>('TURNSTILE_SECRET_KEY');
    if (!secret) {
      this.logger.warn('TURNSTILE_SECRET_KEY no configurada: registro de iglesia sin captcha');
      return;
    }
    if (!token) {
      throw new BadRequestException('Falta completar la verificación anti-bots');
    }

    try {
      const body = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
      const respuesta = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
      const resultado = (await respuesta.json()) as { success?: boolean };
      if (!resultado.success) {
        throw new BadRequestException('La verificación anti-bots falló. Intenta de nuevo.');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('No se pudo validar Turnstile', error);
      throw new BadRequestException('No se pudo validar la verificación anti-bots. Intenta de nuevo.');
    }
  }
}
