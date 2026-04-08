// Workers MUST NOT import from: db/queries/*, db/connection.ts, bun:sqlite
// All DB writes go via backend/services/ called from main thread pool

export enum WorkerMessageType {
  HEALTH_CHECK = "HEALTH_CHECK",
  READER_MODE = "READER_MODE",
  WAYBACK = "WAYBACK",
  SWEEP = "SWEEP",
  OG_METADATA = "OG_METADATA",
}

export interface WorkerMessage<T = unknown> {
  type: WorkerMessageType;
  correlationId: string;
  payload: T;
}

export type WorkerResultStatus = "ok" | "error";

export interface WorkerResult<T = unknown> {
  type: WorkerMessageType;
  correlationId: string;
  status: WorkerResultStatus;
  data?: T;
  error?: string;
}

// Job-specific payload types (main → worker)
export interface HealthCheckPayload { linkId: number; url: string; }
export interface ReaderModePayload  { linkId: number; url: string; }
export interface WaybackPayload     { linkId: number; url: string; }
export interface SweepPayload       { links?: HealthCheckPayload[]; }
export interface OgMetadataPayload  { linkId: number; url: string; }

// Job-specific result types (worker → main)
export interface HealthCheckResult  { linkId: number; statusCode: number; checkedAt: string; }
export interface ReaderModeResult   { linkId: number; contentText: string | null; extractedAt: string; }
export interface WaybackResult      { linkId: number; archiveUrl: string | null; archivedAt: string; }
export interface OgMetadataResult   { linkId: number; ogTitle: string | null; ogDescription: string | null; ogImage: string | null; extractedAt: string; }

// Convenience message aliases
export type HealthCheckMessage = WorkerMessage<HealthCheckPayload>;
export type ReaderModeMessage  = WorkerMessage<ReaderModePayload>;
export type WaybackMessage     = WorkerMessage<WaybackPayload>;
export type SweepMessage       = WorkerMessage<SweepPayload>;
export type OgMetadataMessage  = WorkerMessage<OgMetadataPayload>;
