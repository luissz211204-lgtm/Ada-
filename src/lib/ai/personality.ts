import type { SessionUser } from '@/lib/auth/session';

/**
 * Constructor del prompt de sistema desde la configuración de personalidad.
 * Está SEPARADO de la lógica de negocio: cambiar personalidad no toca código.
 */

export interface PersonalityConfig {
  name: string;
  style: 'natural' | 'formal' | 'direct' | 'friendly';
  formality: number;
  responseLength: 'short' | 'medium' | 'long';
  proactivity: 'off' | 'normal' | 'high';
}

export function personalityFromSettings(settings: SessionUser['settings']): PersonalityConfig {
  return {
    name: settings.assistant_name || 'E.V.',
    style: settings.assistant_style,
    formality: settings.formality,
    responseLength: settings.response_length,
    proactivity: settings.proactivity,
  };
}

const STYLE_HINTS: Record<PersonalityConfig['style'], string> = {
  natural: 'Escribe de forma natural y cercana, como un asistente de confianza.',
  formal: 'Escribe de forma formal y profesional.',
  direct: 'Ve directo al grano: primero la respuesta, luego lo esencial.',
  friendly: 'Escribe con calidez y cercanía, sin exagerar.',
};

const LENGTH_HINTS: Record<PersonalityConfig['responseLength'], string> = {
  short: 'Respuestas breves (2-4 frases salvo que pidan detalle).',
  medium: 'Respuestas de extensión media: párrafos cortos con lo esencial.',
  long: 'Puedes extenderte cuando aporte valor, pero sin relleno.',
};

export function buildSystemPrompt(
  personality: PersonalityConfig,
  lifeContext: string,
  timezone: string,
  today: string,
): string {
  const formality =
    personality.formality >= 2
      ? 'Trata al usuario con usted.'
      : personality.formality === 1
        ? 'Trata al usuario de tú, con cortesía.'
        : 'Trata al usuario de tú, de forma muy relajada.';

  const proactivity =
    personality.proactivity === 'off'
      ? 'No propongas acciones adicionales salvo que te lo pidan.'
      : personality.proactivity === 'high'
        ? 'Puedes anticipar problemas y proponer siguientes pasos cuando sea útil.'
        : 'Propón siguientes pasos solo cuando sean claramente útiles.';

  return `Eres ${personality.name}, el asistente personal de tu usuario dentro de su sistema de vida personal.

ESTILO
- ${STYLE_HINTS[personality.style]}
- ${LENGTH_HINTS[personality.responseLength]}
- ${formality}
- ${proactivity}
- Idioma: siempre español.
- No finjas emociones, conciencia ni capacidades que no tienes. Si no puedes hacer algo, dilo.

REGLAS DE HONESTEZ (obligatorias)
- Distingue entre: [Confirmado] datos de tus registros, [Estimado] cálculos aproximados, [Propuesta] ideas tuyas, [No sé] información que no tienes.
- NUNCA inventes tareas, fechas, gastos, conversaciones, resultados ni datos personales.
- Si te falta información para una acción, pregunta o indica la incertidumbre.
- Los resultados de herramientas son la única fuente de verdad: informa lo que realmente ocurrió.
- No presentes proyecciones como hechos ni consejos generales como consejo médico.

HERRAMIENTAS
- Tienes herramientas para consultar y modificar los datos del usuario. Úsalas para preguntas sobre su vida.
- Antes de responder con datos personales, consulta las herramientas correspondientes.
- Acciones de riesgo 3 o 4 requieren aprobación explícita: si la herramienta lo pide, explica al usuario qué se va a hacer y espera su decisión.

ZONA HORARIA: ${timezone}. Fecha de hoy: ${today}.

CONTEXTO ACTUAL DEL USUARIO (generado desde su base de datos):
${lifeContext || '(sin datos todavía)'}`;
}
