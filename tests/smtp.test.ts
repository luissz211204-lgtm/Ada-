import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import net from 'node:net';
import { sendSmtpMessage } from '@/lib/notifications/smtp';
import { makeUser } from './helpers';
import { one } from '@/lib/db';
import { createReminder, processDueReminders } from '@/lib/services/notifications';

/**
 * Servidor SMTP falso que implementa el mínimo protocolo necesario para
 * verificar que el cliente SMTP real envía mensajes de extremo a extremo.
 */
let server: net.Server;
let port: number;
const received: string[] = [];

beforeAll(async () => {
  server = net.createServer((socket) => {
    socket.write('220 fake SMTP ready\r\n');
    let buf = '';
    let inData = false;
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      if (inData) {
        if (buf.includes('\r\n.\r\n')) {
          received.push(buf);
          buf = '';
          inData = false;
          socket.write('250 ok message accepted\r\n');
        }
        return;
      }
      let idx: number;
      while ((idx = buf.indexOf('\r\n')) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const upper = line.toUpperCase();
        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) socket.write('250-fake\r\n250 ok\r\n');
        else if (upper.startsWith('AUTH')) socket.write('235 ok\r\n');
        else if (upper.startsWith('MAIL FROM')) socket.write('250 ok\r\n');
        else if (upper.startsWith('RCPT TO')) socket.write('250 ok\r\n');
        else if (upper.startsWith('DATA')) {
          inData = true;
          socket.write('354 go ahead\r\n');
        } else if (upper.startsWith('QUIT')) socket.write('221 bye\r\n');
      }
    });
    socket.on('error', () => {
      /* el cliente puede cerrar abruptamente */
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  port = (server.address() as net.AddressInfo).port;
});

afterAll(async () => {
  (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('cliente SMTP', () => {
  it('envía un mensaje a un servidor SMTP real (de prueba)', async () => {
    await sendSmtpMessage(`smtp://127.0.0.1:${port}`, {
      from: 'ev@test.local',
      to: 'usuario@test.local',
      subject: 'Aviso de prueba',
      text: 'Hola SMTP',
    });
    const all = received.join('\n');
    expect(all).toContain('Subject: Aviso de prueba');
    expect(all).toContain('Hola SMTP');
    expect(all).toContain('To: usuario@test.local');
  });

  it('falla con un error real si el servidor no responde', async () => {
    await expect(
      sendSmtpMessage('smtp://127.0.0.1:1', {
        from: 'ev@test.local',
        to: 'usuario@test.local',
        subject: 'x',
        text: 'y',
      }),
    ).rejects.toThrow();
  });
});

describe('canal de correo dentro del procesador de recordatorios', () => {
  it('entrega por SMTP y marca la entrega como delivered', async () => {
    const u = makeUser('smtpok');
    process.env.SMTP_URL = `smtp://127.0.0.1:${port}`;
    try {
      createReminder(u.id, {
        title: 'Correo real',
        remind_at: new Date(Date.now() - 60000).toISOString(),
        channels: ['email'],
      });
      const res = await processDueReminders();
      expect(res.emailsSent).toBe(1);
      const row = one<{ status: string }>(
        "SELECT status FROM notification_deliveries WHERE user_id = ? AND channel = 'email'",
        [u.id],
      );
      expect(row?.status).toBe('delivered');
    } finally {
      delete process.env.SMTP_URL;
    }
  });

  it('marca la entrega como failed si el servidor rechaza la conexión', async () => {
    const u = makeUser('smtpbad');
    process.env.SMTP_URL = 'smtp://127.0.0.1:1';
    try {
      createReminder(u.id, {
        title: 'Correo roto',
        remind_at: new Date(Date.now() - 60000).toISOString(),
        channels: ['email'],
      });
      const res = await processDueReminders();
      expect(res.emailsSent).toBe(0);
      const row = one<{ status: string; last_error: string | null }>(
        "SELECT status, last_error FROM notification_deliveries WHERE user_id = ? AND channel = 'email'",
        [u.id],
      );
      expect(row?.status).toBe('failed');
      expect(row?.last_error).toBeTruthy();
    } finally {
      delete process.env.SMTP_URL;
    }
  });
});
