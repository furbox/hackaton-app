import type { WorkerMessage, HealthCheckPayload, HealthCheckResult, WorkerResult, WorkerMessageType } from "../../../../../workers/types.ts";

self.onmessage = async (event: MessageEvent<WorkerMessage<HealthCheckPayload>>) => {
  const { correlationId, payload } = event.data;
  const result: WorkerResult<HealthCheckResult> = {
    type: "HEALTH_CHECK" as WorkerMessageType,
    correlationId,
    status: "ok",
    data: {
      linkId: payload.linkId,
      statusCode: 200,
      checkedAt: new Date().toISOString(),
    },
  };
  self.postMessage(result);
};
