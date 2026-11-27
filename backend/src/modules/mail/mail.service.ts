import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ReporteFinancieroData,
  TotalPorCategoria,
  nombrePeriodo,
} from '../finanzas/reporte-congregacion/reporte-congregacion.util';
import { EMAIL_PROVIDER, EmailProvider } from './providers/email-provider.interface';

interface InvitacionPredicadorParams {
  email: string;
  /** Nombre del predicador invitado, si el equipo pastoral lo cargó; solo para el saludo. */
  nombrePredicador: string | null;
  nombreIglesia: string;
  tituloEvento: string;
  fecha: Date;
  ubicacion: string | null;
  /** Tal cual `Iglesia.logoUrl`: URL pública del bucket de Storage, o null. */
  logoUrl: string | null;
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
  /** Si el interruptor MORA_PASA_A_GRATUITO está encendido (cambia la advertencia del correo). */
  pasaAGratuito: boolean;
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
  /**
   * Nombres de los predicadores invitados que el equipo cargó CON nombre (los que
   * quedaron sin nombre no se listan — en un correo a la congregación un email suelto
   * no aporta). Vacío si no hay ninguno: entonces el correo no menciona predicador.
   */
  predicadoresInvitados: string[];
  tokenConfirmacion: string;
}

interface RecuperacionContrasenaParams {
  email: string;
  nombre: string;
  token: string;
  /** Minutos de validez del enlace, para decirlo en el cuerpo del correo. */
  expiraEnMinutos: number;
}

interface ReporteFinancieroParams {
  nombreIglesia: string;
  /** Tal cual `Iglesia.logoUrl`, o null. */
  logoUrl: string | null;
  /** Solo el primer nombre del integrante, para el saludo. */
  nombreDestinatario: string;
  reporte: ReporteFinancieroData;
  /**
   * `Integrante.tokenBajaReporte` del destinatario, para el link "dejar de recibir".
   * Null solo en la vista previa del pastor (ahí el link no apunta a nadie real).
   */
  tokenBaja: string | null;
}

export interface ReporteFinancieroCorreo {
  asunto: string;
  html: string;
}

const formatoCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

/** "Ana", "Ana y Beto", "Ana, Beto y Caro" — para listar predicadores en prosa. */
function unirNombres(nombres: string[]): string {
  if (nombres.length <= 1) {
    return nombres[0] ?? '';
  }
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
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

  /**
   * Invitación a un predicador invitado (pastor externo). Plantilla separada y de
   * tono más formal que la convocatoria a la congregación (`enviarConvocatoriaEvento`):
   * acá el destinatario es un par del equipo pastoral, no un asistente.
   */
  async enviarInvitacionPredicador(params: InvitacionPredicadorParams): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const link = `${frontendUrl}/predicacion/${params.tokenConfirmacion}`;
    const fechaTexto = params.fecha.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const horaTexto = params.fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const nombreIglesia = escapeHtml(params.nombreIglesia);
    const tituloEvento = escapeHtml(params.tituloEvento);
    const saludo = params.nombrePredicador
      ? `Estimado/a ${escapeHtml(params.nombrePredicador)}`
      : 'Estimado/a hermano/a';
    const ubicacion = params.ubicacion ? escapeHtml(params.ubicacion) : null;
    const logoHtml = this.logoImgTag(params.logoUrl, nombreIglesia);
    const estadoHtml = this.verEstadoConvocatoriaHtml(params.tokenConfirmacion);

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: `Invitación a predicar — ${params.nombreIglesia}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            ${logoHtml}
            <h2 style="color: #0369a1;">Invitación a predicar</h2>
            <p>${saludo}:</p>
            <p>La iglesia <strong>${nombreIglesia}</strong> le invita a compartir la Palabra en <strong>${tituloEvento}</strong>.</p>
            <table style="margin: 16px 0; font-size: 14px; color: #334155;">
              <tr><td style="padding: 2px 12px 2px 0;">Fecha</td><td><strong>${fechaTexto}</strong></td></tr>
              <tr><td style="padding: 2px 12px 2px 0;">Hora</td><td><strong>${horaTexto}</strong></td></tr>
              ${ubicacion ? `<tr><td style="padding: 2px 12px 2px 0;">Lugar</td><td><strong>${ubicacion}</strong></td></tr>` : ''}
            </table>
            <p>Le agradeceríamos confirmar su disponibilidad:</p>
            <p style="margin-top: 20px;">
              <a href="${link}" style="background:#0369a1;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Confirmar o rechazar la invitación
              </a>
            </p>
            ${estadoHtml}
            <p style="margin-top: 24px; font-size: 13px; color: #64748b;">Equipo pastoral — ${nombreIglesia}</p>
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
    const logoHtml = this.logoImgTag(params.logoUrl, nombreIglesia, backendUrl);

    // Solo se menciona el/los predicador(es) invitado(s) que el equipo cargó con
    // nombre; si el evento no tiene predicador, esta línea no aparece (pedido explícito).
    const predicadores = params.predicadoresInvitados.map((n) => escapeHtml(n));
    const predicadorHtml = predicadores.length
      ? `<p style="margin-top: 4px;">Predica${predicadores.length > 1 ? 'n' : ''}: <strong>${unirNombres(predicadores)}</strong></p>`
      : '';
    const estadoHtml = this.verEstadoConvocatoriaHtml(params.tokenConfirmacion);

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: tituloEvento,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            ${logoHtml}
            <h2 style="color: #0369a1;">${tituloEvento}</h2>
            ${descripcionEvento ? `<p>${descripcionEvento}</p>` : ''}
            ${predicadorHtml}
            <p style="margin-top: 24px;">
              <a href="${linkConfirmar}" style="background:#22c55e;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-right:8px;">
                Sí, voy a asistir
              </a>
              <a href="${linkRechazar}" style="background:#ef4444;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                No podré asistir
              </a>
            </p>
            ${estadoHtml}
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
            <p>Tu facturación venció hace <strong>${diasTexto}</strong>. ${
              params.pasaAGratuito
                ? 'Favor ponerte al día lo antes posible: si la mora llega a 3 días, tu iglesia pasa al plan gratuito y pierde los módulos de pago (tus datos no se borran).'
                : 'Favor ponerte al día lo antes posible para evitar la suspensión del acceso de tu equipo a EvangelicApp.'
            }</p>
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

  /**
   * "Olvidé mi contraseña" desde el login (ver AuthService#requestPasswordReset).
   * Best-effort y no lanza, igual que el resto de MailService: el endpoint
   * responde 200 pase lo que pase (no filtra si la cuenta existe). Si el correo
   * no sale queda logueado como error para diagnosticarlo por monitoreo — no se
   * le muestra un 500 a alguien que ya está bloqueado del sistema y no puede
   * hacer nada con ese error.
   */
  async enviarRecuperacionContrasena(params: RecuperacionContrasenaParams): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const link = `${frontendUrl}/recuperar-contrasena/${params.token}`;
    const nombre = escapeHtml(params.nombre);

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: 'Restablece tu contraseña — EvangelicApp',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0369a1;">Restablecer contraseña</h2>
            <p>Hola ${nombre},</p>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en EvangelicApp. Hacé clic en el botón para elegir una nueva:</p>
            <p style="margin-top: 20px;">
              <a href="${link}" style="background:#0369a1;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Restablecer mi contraseña
              </a>
            </p>
            <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
              El enlace vence en ${params.expiraEnMinutos} minutos y sirve una sola vez.
              Si no pediste esto, ignorá este correo — tu contraseña no cambia hasta que uses el enlace.
            </p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar el correo de recuperación a ${params.email}`, error);
    }
  }

  /** Aviso al pastor de que su iglesia bajó al plan GRATUITO por mora (ver FacturacionRecordatoriosCron). */
  async enviarPlanDegradado(params: { email: string; nombreIglesia: string }): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const nombreIglesia = escapeHtml(params.nombreIglesia);

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: `Tu iglesia pasó al plan gratuito — ${params.nombreIglesia}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #dc2626;">${nombreIglesia}</h2>
            <p>Como la mensualidad lleva varios días vencida, tu iglesia pasó al <strong>plan gratuito</strong>.</p>
            <p>Tus datos siguen guardados y puedes seguir usando la Red de iglesias. Agenda, finanzas, ceremonias, integrantes y notas vuelven a estar disponibles apenas se confirme el pago.</p>
            <p style="margin-top: 24px;">
              <a href="${frontendUrl}" style="background:#0369a1;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Ir a EvangelicApp
              </a>
            </p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar el aviso de plan degradado a ${params.email}`, error);
    }
  }

  /** Link para confirmar el registro autoservicio de una iglesia (ver RedRegistroService). */
  async enviarConfirmacionRegistro(params: {
    email: string;
    nombre: string;
    nombreIglesia: string;
    token: string;
    expiraEnHoras: number;
  }): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const link = `${frontendUrl}/registro/confirmar/${params.token}`;
    const nombre = escapeHtml(params.nombre);
    const nombreIglesia = escapeHtml(params.nombreIglesia);

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: 'Confirma el registro de tu iglesia — EvangelicApp',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0369a1;">¡Bienvenido a la Red de iglesias!</h2>
            <p>Hola ${nombre},</p>
            <p>Recibimos el registro de <strong>${nombreIglesia}</strong> en EvangelicApp. Para activar la cuenta, confirma tu correo:</p>
            <p style="margin-top: 20px;">
              <a href="${link}" style="background:#0369a1;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Confirmar mi correo
              </a>
            </p>
            <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
              El enlace vence en ${params.expiraEnHoras} horas. Si no registraste una iglesia, ignora este correo: no se creará ninguna cuenta.
            </p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar la confirmación de registro a ${params.email}`, error);
    }
  }

  /**
   * Aviso por correo de la Red de iglesias (llamado nuevo en la zona, apoyo recibido,
   * solicitud de alianza...). Mismo texto que la notificación de la campana. Devuelve si
   * salió, igual que enviarReporteFinanciero (se envía por lotes, ver enviarEnLotes).
   */
  async enviarAvisoRed(params: {
    email: string;
    nombre: string;
    titulo: string;
    mensaje: string;
    url: string | null;
  }): Promise<boolean> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const titulo = escapeHtml(params.titulo);
    const mensaje = escapeHtml(params.mensaje);
    const nombre = escapeHtml(params.nombre);
    const link = `${frontendUrl}${params.url ?? '/red'}`;

    try {
      await this.provider.sendMail({
        to: params.email,
        subject: `${params.titulo} — Red de iglesias`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            <p style="color: #64748b; font-size: 13px; margin-bottom: 4px;">Red de iglesias · EvangelicApp</p>
            <h2 style="color: #0369a1; margin-top: 0;">${titulo}</h2>
            <p>Hola ${nombre},</p>
            <p>${mensaje}</p>
            <p style="margin-top: 20px;">
              <a href="${link}" style="background:#0369a1;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
                Ver en EvangelicApp
              </a>
            </p>
            <p style="margin-top: 20px; font-size: 12px; color: #94a3b8;">
              Puedes dejar de recibir estos correos desde tu perfil, en "Notificaciones de la red".
            </p>
          </div>
        `,
      });
      return true;
    } catch (error) {
      this.logger.error(`No se pudo enviar el aviso de la red a ${params.email}`, error);
      return false;
    }
  }

  /**
   * Reporte financiero mensual a la congregación (ver ReporteCongregacionService).
   * Público para que la vista previa del pastor muestre exactamente el mismo HTML que
   * va a llegar. Nombres de iglesia y categorías salen escapados: son texto libre del
   * equipo pastoral y este correo va a casillas externas.
   */
  renderReporteFinanciero(params: ReporteFinancieroParams): ReporteFinancieroCorreo {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const backendUrl = this.config.get<string>('BACKEND_URL', 'http://localhost:3001');
    const nombreIglesia = escapeHtml(params.nombreIglesia);
    const nombre = escapeHtml(params.nombreDestinatario);
    const mes = nombrePeriodo(params.reporte.periodo);
    const { ingresos, egresos, balance } = params.reporte.totales;
    const colorBalance = balance < 0 ? '#dc2626' : '#16a34a';
    const linkBaja = params.tokenBaja ? `${frontendUrl}/reporte-financiero/baja/${params.tokenBaja}` : '#';

    const html = `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1e293b;">
        ${this.logoImgTag(params.logoUrl, nombreIglesia, backendUrl)}
        <h2 style="color: #0369a1; margin-bottom: 4px;">Reporte financiero</h2>
        <p style="margin-top: 0; color: #64748b; text-transform: capitalize;">${mes}</p>
        <p>Hola ${nombre},</p>
        <p>La iglesia <strong>${nombreIglesia}</strong> comparte con su congregación el resumen de sus finanzas de ${mes}.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 15px;">
          <tr><td style="padding: 6px 0;">Ingresos</td><td style="padding: 6px 0; text-align: right;"><strong>${formatoCLP.format(ingresos)}</strong></td></tr>
          <tr><td style="padding: 6px 0;">Egresos</td><td style="padding: 6px 0; text-align: right;"><strong>${formatoCLP.format(egresos)}</strong></td></tr>
          <tr style="border-top: 1px solid #e2e8f0;"><td style="padding: 8px 0;">Balance del mes</td><td style="padding: 8px 0; text-align: right; color: ${colorBalance};"><strong>${formatoCLP.format(balance)}</strong></td></tr>
        </table>
        ${this.tablaCategoriasHtml('Ingresos por categoría', params.reporte.ingresosPorCategoria)}
        ${this.tablaCategoriasHtml('Egresos por categoría', params.reporte.egresosPorCategoria)}
        <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
          Este reporte muestra solo totales del mes: nunca incluye aportes individuales ni datos personales.
        </p>
        <p style="font-size: 13px; color: #64748b;">Equipo pastoral — ${nombreIglesia}</p>
        <p style="margin-top: 16px; font-size: 12px; color: #94a3b8;">
          Recibes este correo porque aceptaste recibir el reporte financiero de ${nombreIglesia}.
          <a href="${linkBaja}" style="color: #94a3b8; text-decoration: underline;">Dejar de recibirlo</a>.
        </p>
      </div>
    `;

    return { asunto: `Reporte financiero de ${mes} — ${params.nombreIglesia}`, html };
  }

  /**
   * Envía un reporte ya renderizado. A diferencia del resto de MailService, devuelve si
   * salió o no (en vez de solo loguear): ReporteCongregacionService cuenta enviados y
   * fallidos para dejarlos en el historial del pastor. Igual nunca lanza.
   */
  async enviarReporteFinanciero(email: string, correo: ReporteFinancieroCorreo): Promise<boolean> {
    try {
      await this.provider.sendMail({ to: email, subject: correo.asunto, html: correo.html });
      return true;
    } catch (error) {
      this.logger.error(`No se pudo enviar el reporte financiero a ${email}`, error);
      return false;
    }
  }

  private tablaCategoriasHtml(titulo: string, filas: TotalPorCategoria[]): string {
    if (filas.length === 0) {
      return '';
    }
    const filasHtml = filas
      .map(
        (fila) =>
          `<tr><td style="padding: 4px 0;">${escapeHtml(fila.categoria)}</td><td style="padding: 4px 0; text-align: right;">${formatoCLP.format(fila.total)}</td></tr>`,
      )
      .join('');
    return `
      <h3 style="font-size: 15px; color: #334155; margin: 20px 0 4px;">${titulo}</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">${filasHtml}</table>
    `;
  }

  /**
   * `<img>` del logo de la iglesia para la cabecera de un correo. `logoUrl` es la URL
   * pública del bucket de Storage (absoluta); `backendUrl` solo se usa como fallback
   * para algún `logoUrl` viejo con ruta relativa (formato previo a Storage) sin re-subir.
   */
  private logoImgTag(logoUrl: string | null, altEscapado: string, backendUrl?: string): string {
    if (!logoUrl) {
      return '';
    }
    const src = logoUrl.startsWith('http') ? logoUrl : `${backendUrl ?? ''}${logoUrl}`;
    return `<img src="${src}" alt="${altEscapado}" style="max-width:72px;max-height:72px;border-radius:8px;margin-bottom:12px;" />`;
  }

  /**
   * Link discreto (texto, no botón) a la página pública de estado de la
   * convocatoria — quién confirmó / rechazó, en vivo. Va tanto en el correo al
   * predicador como en la convocatoria a la congregación; `token` es el
   * `tokenConfirmacion` del propio destinatario (ver ConvocatoriaService).
   */
  private verEstadoConvocatoriaHtml(token: string): string {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    return `<p style="margin-top: 16px; font-size: 13px;">
      <a href="${frontendUrl}/agenda/convocatoria/${token}" style="color:#64748b;text-decoration:underline;">
        Ver quién más confirmó su asistencia
      </a>
    </p>`;
  }
}
