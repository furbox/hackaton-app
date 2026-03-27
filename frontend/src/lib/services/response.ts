import type { ApiResult, ServiceError } from './contracts';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
	if (!value || typeof value !== 'object') {
		return null;
	}

	return value as UnknownRecord;
}

export function normalizeServiceError(
	payload: unknown,
	status: number,
	fallbackMessage = 'Request failed'
): ServiceError {
	const record = asRecord(payload);
	const rawError = record?.error;
	const errorRecord = asRecord(rawError);

	const code =
		typeof errorRecord?.code === 'string'
			? errorRecord.code
			: typeof record?.code === 'string'
				? record.code
				: `HTTP_${status}`;

	const message =
		typeof errorRecord?.message === 'string'
			? errorRecord.message
			: typeof rawError === 'string'
				? rawError
				: typeof record?.message === 'string'
					? record.message
					: fallbackMessage;

	const details =
		errorRecord?.details !== undefined
			? errorRecord.details
			: record?.details !== undefined
				? record.details
				: undefined;

	return {
		code,
		message,
		status,
		...(details !== undefined ? { details } : {})
	};
}

export function successResult<T>(data: T): ApiResult<T> {
	return { ok: true, data };
}

export function errorResult<T>(
	status: number,
	payload: unknown,
	fallbackMessage = 'Request failed'
): ApiResult<T> {
	return {
		ok: false,
		error: normalizeServiceError(payload, status, fallbackMessage)
	};
}
