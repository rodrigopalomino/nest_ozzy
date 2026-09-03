//* src/modules/notificacion/email.service.ts

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// ===================================================================================
// Envío de correo por SMTP.
//
// Si no hay configuración SMTP, el servicio queda deshabilitado y los
// intentos se registran en el log en vez de fallar: así el resto de la
// aplicación funciona en desarrollo sin credenciales.
// ===================================================================================

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly remitente: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;

    this.remitente = process.env.SMTP_FROM ?? 'Ozzy <no-reply@localhost>';

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP no configurado (SMTP_HOST / SMTP_USER / SMTP_PASSWORD). ' +
          'Los correos se registrarán en el log sin enviarse.',
      );
      return;
    }

    const port = Number(process.env.SMTP_PORT ?? '587');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      // 465 es SMTPS implícito; el resto negocia STARTTLS.
      secure: port === 465,
      auth: { user, pass },
    });
  }

  // ===================================================================================
  get habilitado(): boolean {
    return this.transporter !== null;
  }

  // ===================================================================================
  // Devuelve true si el correo salió. No lanza: quien llama decide si
  // reintentar, y la cola de notificaciones ya guarda el estado.
  async enviar(params: {
    para: string;
    asunto: string;
    html: string;
    texto?: string;
  }): Promise<{ enviado: boolean; error?: string }> {
    if (!this.transporter) {
      this.logger.log(
        `[correo simulado] a=${params.para} asunto="${params.asunto}"`,
      );
      return { enviado: false, error: 'SMTP no configurado' };
    }

    try {
      await this.transporter.sendMail({
        from: this.remitente,
        to: params.para,
        subject: params.asunto,
        html: params.html,
        text: params.texto ?? this.htmlATexto(params.html),
      });

      return { enviado: true };
    } catch (e) {
      const error = (e as Error).message;
      this.logger.error(`Fallo al enviar a ${params.para}: ${error}`);
      return { enviado: false, error };
    }
  }

  // ===================================================================================
  // Alternativa en texto plano para los clientes que no muestran HTML.
  private htmlATexto(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
