import { all, one, newId } from '@/lib/db';
import { badRequest } from '@/lib/api/errors';
import { getOwned, updateOwned, deleteOwned } from './crud';
import { audit } from './audit';
import { todayInTz, addDays } from '@/lib/time';

/**
 * Salud y entrenamiento. Datos especialmente sensibles: SOLO accesibles por
 * el propietario y nunca incluidos en notificaciones públicas.
 */

export function listWorkouts(userId: string, includeInactive = false) {
  const workouts = includeInactive
    ? all<{ id: string; name: string; description: string; active: number }>(
        'SELECT id, name, description, active FROM workouts WHERE user_id = ? ORDER BY active DESC, name',
        [userId],
      )
    : all<{ id: string; name: string; description: string; active: number }>(
        'SELECT id, name, description, active FROM workouts WHERE user_id = ? AND active = 1 ORDER BY name',
        [userId],
      );
  return workouts.map((w) => ({
    ...w,
    exercises: all<{
      id: string;
      name: string;
      sets: number | null;
      reps: string | null;
      weight: string | null;
      rest_seconds: number | null;
      position: number;
    }>(
      'SELECT id, name, sets, reps, weight, rest_seconds, position FROM workout_exercises WHERE workout_id = ? AND user_id = ? ORDER BY position',
      [w.id, userId],
    ),
  }));
}

export function createWorkout(
  userId: string,
  input: { name: string; description?: string },
  exercises: { name: string; sets?: number; reps?: string; weight?: string; rest_seconds?: number }[] = [],
) {
  if (!input.name?.trim()) throw badRequest('La rutina necesita un nombre.');
  const workout = one<{ id: string }>(
    'INSERT INTO workouts (id, user_id, name, description) VALUES (?, ?, ?, ?) RETURNING id',
    [newId(), userId, input.name.trim(), input.description || ''],
  );
  if (!workout) throw new Error('No se pudo crear la rutina.');
  let position = 0;
  for (const ex of exercises) {
    if (!ex.name?.trim()) continue;
    one(
      `INSERT INTO workout_exercises (id, workout_id, user_id, name, sets, reps, weight, rest_seconds, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        newId(),
        workout.id,
        userId,
        ex.name.trim(),
        ex.sets ?? null,
        ex.reps ?? null,
        ex.weight ?? null,
        ex.rest_seconds ?? null,
        position++,
      ],
    );
  }
  audit({ userId, action: 'data.create', entity: 'workout', entityId: workout.id });
  return getWorkout(userId, workout.id);
}

export function getWorkout(userId: string, id: string) {
  const workout = getOwned<{ id: string; name: string; description: string; active: number }>('workouts', id, userId);
  const exercises = all(
    'SELECT id, name, sets, reps, weight, rest_seconds, position FROM workout_exercises WHERE workout_id = ? AND user_id = ? ORDER BY position',
    [id, userId],
  );
  return { ...workout, exercises };
}

export function updateWorkout(userId: string, id: string, patch: { name?: string; description?: string; active?: boolean }) {
  getOwned('workouts', id, userId);
  const clean: Record<string, unknown> = {};
  if (patch.name !== undefined) clean.name = patch.name;
  if (patch.description !== undefined) clean.description = patch.description;
  if (patch.active !== undefined) clean.active = patch.active ? 1 : 0;
  return updateOwned('workouts', id, userId, clean);
}

export function deleteWorkout(userId: string, id: string): void {
  deleteOwned('workouts', id, userId);
}

export function addExercise(
  userId: string,
  workoutId: string,
  input: { name: string; sets?: number; reps?: string; weight?: string; rest_seconds?: number; position?: number },
) {
  getOwned('workouts', workoutId, userId);
  if (!input.name?.trim()) throw badRequest('El ejercicio necesita un nombre.');
  return one(
    `INSERT INTO workout_exercises (id, workout_id, user_id, name, sets, reps, weight, rest_seconds, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      workoutId,
      userId,
      input.name.trim(),
      input.sets ?? null,
      input.reps ?? null,
      input.weight ?? null,
      input.rest_seconds ?? null,
      input.position ?? 0,
    ],
  );
}

export function logWorkout(
  userId: string,
  input: {
    workout_id?: string | null;
    workout_name?: string;
    performed_at?: string;
    duration_minutes?: number;
    notes?: string;
    entries?: unknown[];
  },
  tz: string,
) {
  let name = input.workout_name || '';
  if (input.workout_id) {
    name = getOwned<{ name: string }>('workouts', input.workout_id, userId).name;
  }
  if (!name.trim()) throw badRequest('Indica la rutina o un nombre para el entrenamiento.');
  const row = one(
    `INSERT INTO workout_logs (id, user_id, workout_id, workout_name, performed_at, duration_minutes, notes, entries)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      userId,
      input.workout_id ?? null,
      name.trim(),
      input.performed_at || todayInTz(tz),
      input.duration_minutes ?? null,
      input.notes || '',
      JSON.stringify(input.entries ?? []),
    ],
  );
  audit({ userId, action: 'data.create', entity: 'workout_log' });
  return row;
}

export function listWorkoutLogs(userId: string, limit = 50) {
  return all(
    'SELECT * FROM workout_logs WHERE user_id = ? ORDER BY performed_at DESC LIMIT ?',
    [userId, limit],
  );
}

/** Constancia real: entrenamientos por semana en los últimos 8 periodos. */
export function trainingConsistency(userId: string, tz: string) {
  const logs = all<{ performed_at: string }>(
    `SELECT performed_at FROM workout_logs WHERE user_id = ? AND performed_at >= ?`,
    [userId, addDays(todayInTz(tz), -56)],
  );
  const byWeek: Record<string, number> = {};
  const today = todayInTz(tz);
  for (const l of logs) {
    const d = new Date(`${l.performed_at}T12:00:00Z`);
    const weekIndex = Math.floor((Date.now() - d.getTime()) / (7 * 86400000));
    const key = `S-${weekIndex}`;
    byWeek[key] = (byWeek[key] || 0) + 1;
  }
  return { today, byWeek, total: logs.length };
}

export function addMeasurement(
  userId: string,
  input: {
    measured_at?: string;
    weight_kg?: number | null;
    waist_cm?: number | null;
    chest_cm?: number | null;
    arm_cm?: number | null;
    hip_cm?: number | null;
    notes?: string;
  },
  tz: string,
) {
  const row = one(
    `INSERT INTO body_measurements (id, user_id, measured_at, weight_kg, waist_cm, chest_cm, arm_cm, hip_cm, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      userId,
      input.measured_at || todayInTz(tz),
      input.weight_kg ?? null,
      input.waist_cm ?? null,
      input.chest_cm ?? null,
      input.arm_cm ?? null,
      input.hip_cm ?? null,
      input.notes || '',
    ],
  );
  audit({ userId, action: 'data.create', entity: 'body_measurement' });
  return row;
}

export function listMeasurements(userId: string, limit = 100) {
  return all(
    `SELECT * FROM body_measurements WHERE user_id = ? ORDER BY measured_at DESC LIMIT ?`,
    [userId, limit],
  );
}

export function deleteMeasurement(userId: string, id: string): void {
  deleteOwned('body_measurements', id, userId);
}

export function measurementTrend(userId: string) {
  const rows = all<{ measured_at: string; weight_kg: number | null }>(
    'SELECT measured_at, weight_kg FROM body_measurements WHERE user_id = ? ORDER BY measured_at ASC LIMIT 200',
    [userId],
  );
  const withWeight = rows.filter((r) => r.weight_kg !== null);
  const first = withWeight[0];
  const last = withWeight[withWeight.length - 1];
  return {
    points: withWeight.map((r) => ({ date: r.measured_at, weight: Number(r.weight_kg) })),
    first: first ? Number(first.weight_kg) : null,
    last: last ? Number(last.weight_kg) : null,
    change: first && last ? Math.round((Number(last.weight_kg) - Number(first.weight_kg)) * 10) / 10 : null,
    isEstimate: false,
  };
}
