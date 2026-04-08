import {
  WorkerMessageType,
  type OgMetadataPayload,
  type OgMetadataResult,
  type WorkerMessage,
  type WorkerResult,
} from "./types.ts";
import { extractLinkPreviewMetadata } from "../services/link-preview-metadata.ts";

type WorkerPostMessage = (result: WorkerResult<OgMetadataResult>) => void;

type OgMetadataDeps = {
  postMessage?: WorkerPostMessage;
};

export async function runOgMetadataExtraction(
  payload: OgMetadataPayload
): Promise<OgMetadataResult> {
  const result = await extractLinkPreviewMetadata({
    url: payload.url,
    timeoutMs: 10_000, // 10 second timeout
  });

  if (result.ok) {
    return {
      linkId: payload.linkId,
      ogTitle: result.data.title,
      ogDescription: result.data.description,
      ogImage: result.data.image,
      extractedAt: new Date().toISOString(),
    };
  }

  // Return null values on failure (timeout, fetch failed, etc.)
  return {
    linkId: payload.linkId,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    extractedAt: new Date().toISOString(),
  };
}

export async function handleOgMetadataMessage(
  message: WorkerMessage<OgMetadataPayload>,
  deps: OgMetadataDeps = {}
): Promise<void> {
  const postMessage = deps.postMessage ?? ((result) => (globalThis as typeof globalThis & { postMessage: WorkerPostMessage }).postMessage(result));

  if (message.type !== WorkerMessageType.OG_METADATA) {
    postMessage({
      type: message.type,
      correlationId: message.correlationId,
      status: "error",
      error: `Unsupported message type: ${message.type}`,
    });
    return;
  }

  try {
    const data = await runOgMetadataExtraction(message.payload);
    postMessage({
      type: WorkerMessageType.OG_METADATA,
      correlationId: message.correlationId,
      status: "ok",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    postMessage({
      type: WorkerMessageType.OG_METADATA,
      correlationId: message.correlationId,
      status: "error",
      error: message,
    });
  }
}

type OgMetadataWorkerMessage = WorkerMessage<OgMetadataPayload>;
type OgMetadataWorkerScope = typeof globalThis & {
  addEventListener?: (type: "message", listener: (event: MessageEvent<OgMetadataWorkerMessage>) => void) => void;
  postMessage?: WorkerPostMessage;
};

const workerScope = globalThis as OgMetadataWorkerScope;

if (typeof workerScope.postMessage === "function" && typeof workerScope.addEventListener === "function") {
  workerScope.addEventListener("message", (event: MessageEvent<OgMetadataWorkerMessage>) => {
    void handleOgMetadataMessage(event.data).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown worker error";
      workerScope.postMessage?.({
        type: event.data.type,
        correlationId: event.data.correlationId,
        status: "error",
        error: message,
      });
    });
  });
}
