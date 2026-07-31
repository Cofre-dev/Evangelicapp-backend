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

interface ConvocatoriaEventoParams {
  email: string;
  tituloEvento: string;
  descripcionEvento: string | null;
  nombreIglesia: string;
  /** Ruta relativa tal cual se guarda en Iglesia.logoUrl (ej. "/uploads/logos/x.png"), o null. */
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

    // logoUrl se guarda como ruta relativa servida por app.useStaticAssets (/uploads/...);
    // un <img> en un correo externo necesita URL absoluta, de ahí BACKEND_URL.
    const logoHtml = params.logoUrl
      ? `<img src="${backendUrl}${params.logoUrl}" alt="${nombreIglesia}" style="max-width:72px;max-height:72px;border-radius:8px;margin-bottom:12px;" />`
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
}
