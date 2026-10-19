import net from 'node:net';
import { URL } from 'node:url';
import crypto from 'node:crypto';

export interface SmtpOpts {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Envío de correo SMTP muy ligero (crudo sobre TCP + LOGIN/PLAIN según puerto).
 * No soporta STARTTLS estricto; suficiente para pruebas. Para producción
 * usar un proveedor con API (Resend, SendGrid, Mailgun) y documentarlo.
 */
export async function sendSmtpMessage(smtpUrl: string, opts: SmtpOpts): Promise<void> {
  const url = new URL(smtpUrl);
  const host = url.hostname;
  const port = Number(url.port || (url.protocol === 'smtps:' ? 465 : 587));
  const user = decodeURIComponent(url.username || '');
  const pass = decodeURIComponent(url.password || '');

  const line = (s: string) => Buffer.from(s + '\r\n', 'utf8');

  /**
   * Espera la línea de respuesta final del servidor para un comando.
   * SMTP usa respuestas multilínea (`250-...` continúa, `250 ...` termina),
   * por lo que solo resolvemos con una línea cuyo código va seguido de espacio.
   */
  function cmd(client: net.Socket, data: string, expect: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let acc = '';
      function onData(chunk: Buffer) {
        acc += chunk.toString('utf8');
        const lines = acc.split('\r\n').filter((l) => l.length > 0);
        const last = lines[lines.length - 1];
        // Todavía no llega una línea final (posible respuesta en curso).
        if (!/^\d{3} /.test(last)) return;
        client.off('data', onData);
        const code = Number(last.slice(0, 3));
        if (code >= 400 || code < expect) {
          reject(new Error(`SMTP error: ${acc.trim()}`));
          return;
        }
        resolve(acc.trim());
      }
      client.on('data', onData);
      client.write(line(data));
    });
  }

  const client = await new Promise<net.Socket>((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => resolve(socket));
    socket.once('error', reject);
  });

  try {
    await readGreeting(client);
    await cmd(client, `EHLO ${host}`, 250);
    if (user) {
      const auth = Buffer.from(`${user}\x00${user}\x00${pass}`, 'utf8').toString('base64');
      await cmd(client, `AUTH PLAIN ${auth}`, 235);
    }
    await cmd(client, `MAIL FROM:<${opts.from}>`, 250);
    await cmd(client, `RCPT TO:<${opts.to}>`, 250);
    await cmd(client, 'DATA', 354);
    const date = new Date().toUTCString();
    let msg = `Date: ${date}\r\n`;
    msg += `From: ${opts.from}\r\n`;
    msg += `To: ${opts.to}\r\n`;
    msg += `Subject: ${opts.subject}\r\n`;
    msg += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
    msg += opts.text + '\r\n.\r\n';
    client.write(msg);
    await new Promise<void>((resolve, reject) => {
      let acc = '';
      client.on('data', function h(chunk: Buffer) {
        acc += chunk.toString('utf8');
        const lines = acc.split('\r\n').filter((l) => l.length > 0);
        const last = lines[lines.length - 1];
        if (/^2\d\d /.test(last)) {
          client.off('data', h);
          resolve();
        } else if (/^[45]\d\d /.test(last)) {
          client.off('data', h);
          reject(new Error(acc.trim()));
        }
      });
      client.on('error', reject);
    });
  } finally {
    client.end();
  }
}

function readGreeting(client: net.Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('SMTP timeout')), 5000);
    client.once('data', (chunk) => {
      clearTimeout(t);
      const s = chunk.toString('utf8');
      if (/^220\b/.test(s)) resolve();
      else reject(new Error(s.trim()));
    });
    client.once('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}
