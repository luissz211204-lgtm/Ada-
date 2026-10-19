import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import {
  listWorkouts,
  createWorkout,
  updateWorkout,
  deleteWorkout,
  addExercise,
  logWorkout,
  listWorkoutLogs,
  addMeasurement,
  listMeasurements,
  deleteMeasurement,
  measurementTrend,
  trainingConsistency,
} from '@/lib/services/health';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const tz = authedUser.settings.timezone || 'America/Monterrey';
    return {
      data: {
        workouts: listWorkouts(userId, url.searchParams.get('all') === '1'),
        logs: listWorkoutLogs(userId),
        measurements: listMeasurements(userId),
        trend: measurementTrend(userId),
        consistency: trainingConsistency(userId, tz),
      },
    };
  },
});

const exercise = z.object({
  name: z.string().min(1),
  sets: z.coerce.number().optional(),
  reps: z.string().optional(),
  weight: z.string().optional(),
  rest_seconds: z.coerce.number().optional(),
});

const body = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('addWorkout'),
    name: z.string().min(1),
    description: z.string().optional(),
    exercises: z.array(exercise).optional(),
  }),
  z.object({
    action: z.literal('updateWorkout'),
    id: z.string().min(1),
    name: z.string().optional(),
    description: z.string().optional(),
    active: z.boolean().optional(),
  }),
  z.object({ action: z.literal('deleteWorkout'), id: z.string().min(1) }),
  z.object({ action: z.literal('addExercise'), workoutId: z.string().min(1), exercise: exercise }),
  z.object({
    action: z.literal('logWorkout'),
    workout_id: z.string().nullable().optional(),
    workout_name: z.string().optional(),
    duration_minutes: z.coerce.number().optional(),
    notes: z.string().optional(),
    performed_at: z.string().optional(),
  }),
  z.object({
    action: z.literal('addMeasurement'),
    measured_at: z.string().optional(),
    weight_kg: z.coerce.number().nullable().optional(),
    waist_cm: z.coerce.number().nullable().optional(),
    chest_cm: z.coerce.number().nullable().optional(),
    arm_cm: z.coerce.number().nullable().optional(),
    hip_cm: z.coerce.number().nullable().optional(),
    notes: z.string().optional(),
  }),
  z.object({ action: z.literal('deleteMeasurement'), id: z.string().min(1) }),
]);

export const POST = defineHandler({
  method: 'POST',
  schema: body,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const tz = authedUser.settings.timezone || 'America/Monterrey';
    switch (body.action) {
      case 'addWorkout':
        return { data: createWorkout(userId, { name: body.name, description: body.description }, body.exercises ?? []), status: 201 };
      case 'updateWorkout':
        return { data: updateWorkout(userId, body.id, body) };
      case 'deleteWorkout':
        deleteWorkout(userId, body.id);
        return { data: { ok: true } };
      case 'addExercise':
        return { data: addExercise(userId, body.workoutId, body.exercise), status: 201 };
      case 'logWorkout':
        return { data: logWorkout(userId, body, tz), status: 201 };
      case 'addMeasurement':
        return { data: addMeasurement(userId, body, tz), status: 201 };
      case 'deleteMeasurement':
        deleteMeasurement(userId, body.id);
        return { data: { ok: true } };
    }
  },
});
