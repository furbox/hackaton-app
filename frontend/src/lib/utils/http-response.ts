export async function readJsonPayload(response: Response): Promise<{ isJson: boolean; payload: unknown | null }> {
	const contentType = response.headers.get('content-type') ?? '';
	const isJson = contentType.toLowerCase().includes('application/json');
	const bodyText = await response.text();

	if (!isJson || !bodyText) {
		return { isJson, payload: null };
	}

	try {
		return { isJson, payload: JSON.parse(bodyText) };
	} catch {
		return { isJson, payload: null };
	}
}

export function extractApiMessage(payload: unknown): string | null {
	if (!payload || typeof payload !== 'object') {
		return null;
	}

	const message = (payload as { message?: unknown }).message;
	if (typeof message === 'string' && message.trim().length > 0) {
		return message;
	}

	const error = (payload as { error?: unknown }).error;
	if (typeof error === 'string' && error.trim().length > 0) {
		return error;
	}

	const nestedMessage = (error as { message?: unknown } | undefined)?.message;
	if (typeof nestedMessage === 'string' && nestedMessage.trim().length > 0) {
		return nestedMessage;
	}

	return null;
}
