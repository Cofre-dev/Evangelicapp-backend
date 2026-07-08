import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface InvitacionPredicadorParams {
  email: string;
  nombreIglesia: string;
  tituloEvento: string;
  fecha: Date;
  tokenConfirmacion: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: this.config.get<number>('SMTP_PORT', 1025),
      secure: false,
    });
  }

  async enviarInvitacionPredicador(params: InvitacionPredicadorParams): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const link = `${frontendUrl}/predicacion/${params.tokenConfirmacion}`;
    const fechaTexto = params.fecha.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('MAIL_FROM', '"Evangelicapp" <noreply@evangelicapp.cl>'),
        to: params.email,
        subject: `Invitación a predicar — ${params.nombreIglesia}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #0369a1;">${params.nombreIglesia}</h2>
            <p>Has sido invitado a predicar en <strong>${params.tituloEvento}</strong>.</p>
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
}
