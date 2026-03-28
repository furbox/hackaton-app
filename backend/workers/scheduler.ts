import { getWorkerPool } from "./pool.ts";
import { WorkerMessageType, type WorkerMessage, type SweepPayload } from "./types.ts";

const SWEEP_INTERVAL_MS = Number.parseInt(process.env.WORKER_SWEEP_INTERVAL_MS ?? "300000", 10); // 5 min default
const SWEEP_ENABLED = process.env.WORKER_SWEEP_ENABLED === "true";
const HEALTH_CHECK_BATCH_SIZE = Number.parseInt(process.env.HEALTH_CHECK_BATCH_SIZE ?? "50", 10);

let sweepTimer: ReturnType<typeof setInterval> | null = null;

async function fetchLinksForHealthSweep(): Promise<Array<{ id: number; url: string }>> {
  // TODO: Implementar query real a DB cuando tengamos tabla de worker_jobs
  // Por ahora, retornamos array vacío (sin-op)
  return [];
}

async function triggerHealthSweep(): Promise<void> {
  try {
    const pool = getWorkerPool();
    const links = await fetchLinksForHealthSweep();

    if (links.length === 0) {
      return;
    }

    console.log(`[scheduler] Triggering health sweep for ${links.length} links`);

    const message: WorkerMessage<SweepPayload> = {
      type: WorkerMessageType.SWEEP,
      correlationId: `sweep-health-${Date.now()}`,
      payload: {
        links: links.map((link) => ({ linkId: link.id, url: link.url }))
      }
    };

    pool.dispatch(message);
  } catch (error) {
    console.error("[scheduler] Failed to trigger health sweep:", error);
  }
}

export function startScheduler(): void {
  if (!SWEEP_ENABLED) {
    console.log("[scheduler] Sweep disabled via WORKER_SWEEP_ENABLED=false");
    return;
  }

  if (sweepTimer !== null) {
    console.warn("[scheduler] Already started");
    return;
  }

  sweepTimer = setInterval(triggerHealthSweep, SWEEP_INTERVAL_MS);
  console.log(`[scheduler] Started with interval ${SWEEP_INTERVAL_MS}ms`);
}

export async function stopScheduler(): Promise<void> {
  if (sweepTimer !== null) {
    clearInterval(sweepTimer);
    sweepTimer = null;
    console.log("[scheduler] Stopped");
  }
}
