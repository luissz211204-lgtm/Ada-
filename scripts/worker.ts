import { initDatabase, tickWorker } from '@/lib/server/bootstrap';

const INTERVAL = Number(process.env.WORKER_INTERVAL_SECONDS || 30) * 1000;
let timer: NodeJS.Timeout | null = null;

function log(msg: string, meta?: unknown) {
  const base = `[worker] ${new Date().toISOString()} ${msg}`;
  console.log(base, meta ?? '');
}

function tick() {
  tickWorker()
    .then((res) => log('tick', res))
    .catch((err) => log('error', err instanceof Error ? err.message : err));
}

export function startWorker(): void {
  if (timer) return;
  initDatabase();
  log(`arrancando (intervalo ${INTERVAL / 1000}s)`);
  // Primer tick inmediato
  tick();
  timer = setInterval(tick, INTERVAL);
}

export function stopWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log('detenido');
  }
}

if (require.main === module) {
  startWorker();
}
