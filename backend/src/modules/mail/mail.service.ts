import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, EmailProvider } from './providers/email-provider.interface';

interface InvitacionPredicadorParams {
  email: string;
  nombreIglesia: string;
  tituloEvento: string;
  fecha: Date;
  tokenConfirmacion: string;
}

interface RecordatorioFacturacionParams {
  email: string;
  nombreIglesia: string;
  proximaFacturacion: Date;
}

interface FacturacionVencidaParams {
  email: string;
  nombreIglesia: string;
  diasEnMora: number;
}

interface ConvocatoriaEventoParams {
  email: string;
  tituloEvento: string;
  descripcionEvento: string | null;
  nombreIglesia: string;
  /** Tal cual se guarda en Iglesia.logoUrl: URL pública del bucket de Supabase Storage, o null. */
  logoUrl: string | null;
  /** Nombre completo del pastor/usuario que creó el evento; null si Evento.creadoPorId es null. */
  nombreCreador: string | null;
  tokenConfirmacion: string;
}

/**
 * `nombreIglesia`/`tituloEvento` los controla cualquier MANAGER/USUARIO
 * (ej. `CreateEventoDto.titulo` solo exige @IsString @IsNotEmpty) y este HTML sale
 * a una casilla externa real — sin escapar, un título malicioso podría inyectar
 * markup/enlaces en el correo del predicador invitado.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  async enviarInvitacionPredicador(params: InvitacionPredicadorParams): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const link = `${frontendUrl}/predicacion/${params.tokenConfirmacion}`;
    const fechaTexto = params.fecha.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const nombreIglesia = escapeHtml(params.nombreIglesia);
    const tituloEvento = escapeHtml(params.tituloEvento);

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: `Invitación a predicar — ${params.nombreIglesia}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0369a1;">${nombreIglesia}</h2>
            <p>Has sido invitado a predicar en <strong>${tituloEvento}</strong>.</p>
            <p>Fecha: ${fechaTexto}</p>
            <p style="margin-top: 24px;">
              <a href="${link}" style="background:#38bdf8;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Responder invitación
              </a>
            </p>
          </div>
        `,
      });
    } catch (error) {
      // Un fallo de envío no debe tumbar la creación del evento — el pastor
      // igual puede compartir el link de confirmación manualmente si hace falta.
      this.logger.error(`No se pudo enviar la invitación a ${params.email}`, error);
    }
  }

  /**
   * Convocatoria masiva a los Integrantes de la iglesia para un evento con
   * `notificarIntegrantes = true`. Título/descripción del evento y nombre de
   * iglesia/creador salen escapados por la misma razón que en
   * `enviarInvitacionPredicador`: son texto libre del equipo pastoral.
   */
  async enviarConvocatoriaEvento(params: ConvocatoriaEventoParams): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const backendUrl = this.config.get<string>('BACKEND_URL', 'http://localhost:3001');
    const linkBase = `${frontendUrl}/agenda/asistencia/${params.tokenConfirmacion}`;
    // Ambos botones apuntan al frontend (que llama al GET/POST del backend) con la
    // respuesta pre-seleccionada por query param — el correo nunca muta estado
    // directamente vía un link GET.
    const linkConfirmar = `${linkBase}?respuesta=CONFIRMADO`;
    const linkRechazar = `${linkBase}?respuesta=RECHAZADO`;

    const tituloEvento = escapeHtml(params.tituloEvento);
    const nombreIglesia = escapeHtml(params.nombreIglesia);
    const descripcionEvento = params.descripcionEvento ? escapeHtml(params.descripcionEvento) : null;
    const firmante = params.nombreCreador
      ? escapeHtml(params.nombreCreador)
      : `el equipo pastoral de ${nombreIglesia}`;

    // logoUrl es la URL pública del bucket de Supabase Storage (absoluta). Se mantiene
    // el fallback con BACKEND_URL por si queda algún logoUrl viejo con ruta relativa
    // (formato previo a la migración a Storage) sin re-subir.
    const logoSrc = params.logoUrl
      ? params.logoUrl.startsWith('http')
        ? params.logoUrl
        : `${backendUrl}${params.logoUrl}`
      : null;
    const logoHtml = logoSrc
      ? `<img src="${logoSrc}" alt="${nombreIglesia}" style="max-width:72px;max-height:72px;border-radius:8px;margin-bottom:12px;" />`
      : '';

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: tituloEvento,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            ${logoHtml}
            <h2 style="color: #0369a1;">${tituloEvento}</h2>
            ${descripcionEvento ? `<p>${descripcionEvento}</p>` : ''}
            <p style="margin-top: 24px;">
              <a href="${linkConfirmar}" style="background:#22c55e;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-right:8px;">
                Sí, voy a asistir
              </a>
              <a href="${linkRechazar}" style="background:#ef4444;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                No podré asistir
              </a>
            </p>
            <p style="margin-top: 24px; font-size: 13px; color: #64748b;">${firmante} — ${nombreIglesia}</p>
          </div>
        `,
      });
    } catch (error) {
      // Mismo criterio que enviarInvitacionPredicador: un fallo de envío individual
      // no debe afectar al resto de la convocatoria ni a la creación del evento.
      this.logger.error(`No se pudo enviar la convocatoria a ${params.email}`, error);
    }
  }

  /** Aviso preventivo, 7 días antes del vencimiento (ver FacturacionRecordatoriosCron). */
  async enviarRecordatorioFacturacion(params: RecordatorioFacturacionParams): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const nombreIglesia = escapeHtml(params.nombreIglesia);
    const fechaTexto = params.proximaFacturacion.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: `Recordatorio: tu facturación vence en 7 días — ${params.nombreIglesia}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0369a1;">${nombreIglesia}</h2>
            <p>Te escribimos para avisarte que la próxima facturación de tu cuenta en EvangelicApp vence el <strong>${fechaTexto}</strong> (en 7 días).</p>
            <p>No es necesario hacer nada todavía — este es solo un recordatorio para que lo tengas presente.</p>
            <p style="margin-top: 24px;">
              <a href="${frontendUrl}" style="background:#38bdf8;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Ir a EvangelicApp
              </a>
            </p>
          </div>
        `,
      });
    } catch (error) {
      // Best-effort, mismo criterio que el resto de MailService: un correo que no sale
      // no debe tumbar la corrida del cron para el resto de las iglesias.
      this.logger.error(`No se pudo enviar el recordatorio de facturación a ${params.email}`, error);
    }
  }

  /**
   * Aviso de mora, enviado día por medio mientras la iglesia no pague (ver
   * FacturacionRecordatoriosCron) — 1, 3, 5, 7... días vencida, no todos los días.
   */
  async enviarFacturacionVencida(params: FacturacionVencidaParams): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const nombreIglesia = escapeHtml(params.nombreIglesia);
    const diasTexto = params.diasEnMora === 1 ? '1 día' : `${params.diasEnMora} días`;

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: `Tu facturación está vencida — ${params.nombreIglesia}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #dc2626;">${nombreIglesia}</h2>
            <p>Tu facturación venció hace <strong>${diasTexto}</strong>. Favor ponerte al día lo antes posible para evitar la suspensión del acceso de tu equipo a EvangelicApp.</p>
            <p style="margin-top: 24px;">
              <a href="${frontendUrl}" style="background:#dc2626;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Ir a EvangelicApp
              </a>
            </p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar el aviso de facturación vencida a ${params.email}`, error);
    }
  }
}
