import { describe, it, expect } from 'vitest';
import { makeUser } from './helpers';
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  completeTask,
  deleteTask,
  setDependencies,
  inboxAdd,
  inboxConvert,
  inboxList,
} from '@/lib/services/tasks';
import { addDays, todayInTz } from '@/lib/time';

describe('servicio de tareas', () => {
  it('crea, lista y actualiza tareas', () => {
    const u = makeUser('tasks');
    const task = createTask(u.id, { title: 'Comprar pan', priority: 1 });
    expect(task.title).toBe('Comprar pan');
    expect(task.status).toBe('pending');

    const list = listTasks(u.id, { status: ['pending'] });
    expect(list.map((t) => t.id)).toContain(task.id);

    const updated = updateTask(u.id, task.id, { title: 'Comprar pan integral', priority: 3 });
    expect(updated.title).toBe('Comprar pan integral');
    expect(updated.priority).toBe(3);
  });

  it('valida el título obligatorio', () => {
    const u = makeUser('title');
    expect(() => createTask(u.id, { title: '   ' })).toThrow(/título/i);
  });

  it('completa tareas y genera la siguiente ocurrencia de una recurrente', () => {
    const u = makeUser('recur');
    const today = todayInTz('America/Monterrey');
    const task = createTask(u.id, {
      title: 'Estudiar',
      due_date: today,
      recurrence: { freq: 'daily' },
    });
    const { task: done, next } = completeTask(u.id, task.id);
    expect(done.status).toBe('done');
    expect(done.completed_at).toBeTruthy();
    expect(next).toBeTruthy();
    expect(next!.status).toBe('pending');
    expect(next!.due_date).toBe(addDays(today, 1));
  });

  it('impide completar una tarea con dependencias abiertas', () => {
    const u = makeUser('deps');
    const base = createTask(u.id, { title: 'Base' });
    const dependent = createTask(u.id, { title: 'Dependiente' });
    setDependencies(u.id, dependent.id, [base.id]);

    expect(() => completeTask(u.id, dependent.id)).toThrow(/Base/);
    completeTask(u.id, base.id);
    expect(completeTask(u.id, dependent.id).task.status).toBe('done');
  });

  it('aísla las tareas entre usuarios', () => {
    const a = makeUser('a');
    const b = makeUser('b');
    const task = createTask(a.id, { title: 'Privada' });

    expect(() => getTask(b.id, task.id)).toThrow();
    expect(() => updateTask(b.id, task.id, { title: 'Hackeada' })).toThrow();
    expect(() => deleteTask(b.id, task.id)).toThrow();

    // El propietario conserva su tarea intacta.
    expect(getTask(a.id, task.id).title).toBe('Privada');
  });

  it('convierte elementos de la bandeja en tareas', () => {
    const u = makeUser('inbox');
    const item = inboxAdd(u.id, 'Llamar al dentista');
    const { task, item: converted } = inboxConvert(u.id, item.id, {});
    expect(task.title).toBe('Llamar al dentista');
    expect(converted.status).toBe('converted');
    expect(inboxList(u.id, 'pending').find((x) => x.id === item.id)).toBeUndefined();
    expect(() => inboxConvert(u.id, item.id, {})).toThrow();
  });
});
