# E.V. — Integraciones

## 1. Inteligencia artificial (obligatoria para chat)
- Capa `src/lib/ai/*` desacoplada, cliente OpenAI-compatible (`chat/completions`)
- Variables: `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_MAX_TOKENS`, `AI_MONTHLY_BUDGET_CENTS`
- Proveedores compatibles: OpenAI, Groq, Together, Ollama/LM Studio (local con `AI_BASE_URL` apuntando al servidor local)
- **Nota:** una suscripción de ChatGPT NO incluye acceso a la API. Debes obtener una API key aparte.

## 2. Correo electrónico (opcional)
- SMTP vía `SMTP_URL` (`smtp://user:pass@host:587`)
- `EMAIL_FROM` para el remitente
- Si no está configurado, el canal queda `skipped` con motivo

## 3. WhatsApp Business Platform (fase 6, preparado)
- Tabla `integrations` con `provider='whatsapp'` y secretos cifrados
- Webhooks verificados con `WHATSAPP_VERIFY_TOKEN`, prevención de duplicados
- No declarar conectado hasta probar conexión real

## 4. Voz (fase 6)
- Cliente Web Speech API / botón de micrófono
- Sin credenciales externas para transcripción local

## 5. Dispositivos
- Tabla `connected_devices` con push token para notificaciones
- Web push pendiente (requiere VAPID)

## 6. Cron externo
- `POST /api/cron/reminders` con cabecera `x-ev-cron-secret`
- Vercel Cron o similar

## 7. Activación
1. Configurar variables en `.env.local`
2. Reiniciar servidor
3. Guardar estado en `integrations` (cifrado)
4. Probar con datos reales antes de declarar activo
