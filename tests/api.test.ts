import { describe, it, expect } from 'vitest';
import { apiRequest, readJson, makeUser, paramsCtx, noParams } from './helpers';
import { POST as registerPOST } from '@/app/api/auth/register/route';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as logoutPOST } from '@/app/api/auth/logout/route';
import { GET as meGET } from '@/app/api/me/route';
import { GET as tasksGET, POST as tasksPOST } from '@/app/api/tasks/route';
import { GET as taskGET, PATCH as taskPATCH } from '@/app/api/tasks/[id]/route';
import { POST as taskCompletePOST } from '@/app/api/tasks/[id]/complete/route';
import { GET as remindersGET, POST as remindersPOST } from '@/app/api/reminders/route';
import { POST as reminderActionPOST } from '@/app/api/reminders/[id]/route';

describe('rutas HTTP mediante el manejador', () => {
  it('registra, autentica, crea y completa tareas, y cierra sesión', async () => {
    const email = `api-${Date.now()}@test.local`;
    const reg = await registerPOST(
      apiRequest('/api/auth/register', {
        method: 'POST',
        body: { name: 'Ana', email, password: 'clave12345' },
      }),
      noParams(),
    );
    expect(reg.status).toBe(200);
    const token: string = (await readJson(reg)).data.token;
    expect(token).toBeTruthy();

    const me = await meGET(apiRequest('/api/me', { token }), noParams());
    expect(me.status).toBe(200);
    expect((await readJson(me)).data.user.email).toBe(email);

    const created = await tasksPOST(
      apiRequest('/api/tasks', { method: 'POST', token, body: { title: 'Tarea API' } }),
      noParams(),
    );
    expect(created.status).toBe(201);
    const taskId = (await readJson(created)).data.id;

    const list = await tasksGET(apiRequest('/api/tasks', { token }), noParams());
    expect((await readJson(list)).data.some((t: any) => t.id === taskId)).toBe(true);

    const done = await taskCompletePOST(
      apiRequest(`/api/tasks/${taskId}/complete`, { method: 'POST', token }),
      paramsCtx({ id: taskId }),
    );
    expect((await readJson(done)).data.task.status).toBe('done');

    const out = await logoutPOST(apiRequest('/api/auth/logout', { method: 'POST', token }), noParams());
    expect(out.status).toBe(200);

    const meAfter = await meGET(apiRequest('/api/me', { token }), noParams());
    expect(meAfter.status).toBe(401);
  });

  it('rechaza el acceso sin sesión', async () => {
    const res = await meGET(apiRequest('/api/me'), noParams());
    expect(res.status).toBe(401);
    const body = await readJson(res);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('unauthorized');
  });

  it('aísla los recursos entre usuarios en la API', async () => {
    const a = makeUser('apia');
    const b = makeUser('apib');
    const created = await tasksPOST(
      apiRequest('/api/tasks', { method: 'POST', token: a.token, body: { title: 'Solo A' } }),
      noParams(),
    );
    const taskId = (await readJson(created)).data.id;

    const notMine = await taskGET(
      apiRequest(`/api/tasks/${taskId}`, { token: b.token }),
      paramsCtx({ id: taskId }),
    );
    expect(notMine.status).toBe(404);

    const patch = await taskPATCH(
      apiRequest(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        token: b.token,
        body: { title: 'Hack' },
      }),
      paramsCtx({ id: taskId }),
    );
    expect(patch.status).toBe(404);
  });

  it('valida el cuerpo de las peticiones', async () => {
    const u = makeUser('apival');
    const res = await tasksPOST(
      apiRequest('/api/tasks', { method: 'POST', token: u.token, body: { title: '' } }),
      noParams(),
    );
    expect(res.status).toBe(422);
    expect((await readJson(res)).error.code).toBe('validation_error');
  });

  it('crea y pospone recordatorios por la API', async () => {
    const u = makeUser('apirem');
    const created = await remindersPOST(
      apiRequest('/api/reminders', {
        method: 'POST',
        token: u.token,
        body: { title: 'Recordar', remind_at: new Date(Date.now() + 3600000).toISOString() },
      }),
      noParams(),
    );
    expect(created.status).toBe(201);
    const id = (await readJson(created)).data.id;

    const list = await remindersGET(apiRequest('/api/reminders', { token: u.token }), noParams());
    expect((await readJson(list)).data.some((r: any) => r.id === id)).toBe(true);

    const snoozed = await reminderActionPOST(
      apiRequest(`/api/reminders/${id}`, {
        method: 'POST',
        token: u.token,
        body: { action: 'snooze', minutes: 15 },
      }),
      paramsCtx({ id }),
    );
    expect((await readJson(snoozed)).data.status).toBe('snoozed');
  });

  it('permite iniciar sesión con credenciales válidas', async () => {
    const email = `login-${Date.now()}@test.local`;
    await registerPOST(
      apiRequest('/api/auth/register', {
        method: 'POST',
        body: { name: 'Luis', email, password: 'clave12345' },
      }),
      noParams(),
    );
    const login = await loginPOST(
      apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email, password: 'clave12345' },
      }),
      noParams(),
    );
    expect(login.status).toBe(200);
    expect((await readJson(login)).data.token).toBeTruthy();
  });
});
