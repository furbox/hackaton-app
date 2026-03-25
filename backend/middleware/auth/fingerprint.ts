import { createAuditLog, extractRequestInfo } from "../../services/audit-log.service.js";
import type { Session } from "./session.ts";

function toNumericUserId(value: unknown): number | undefined {
	const numericId = Number(value);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		return undefined;
	}
	return numericId;
}

function previewToken(value: unknown): string | undefined {
	if (typeof value !== "string" || value.length === 0) {
		return undefined;
	}
	return `${value.slice(0, 8)}...`;
}

function getStoredFingerprint(session: Session): string | undefined {
	let storedFingerprint = (session as any).fingerprint;

	if (!storedFingerprint && (session as any).extra) {
		storedFingerprint = (session as any).extra.fingerprint;
	}

	if (!storedFingerprint) {
		storedFingerprint = (session as any)._fingerprint;
	}

	return storedFingerprint;
}

export async function generateFingerprint(ip: string, userAgent: string): Promise<string> {
	const data = `${ip}|${userAgent}`;
	const encoder = new TextEncoder();
	const bytes = encoder.encode(data);
	const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	return hashHex;
}

export function extractIP(request: Request): string {
	const trustProxy = process.env.TRUST_PROXY === "true";

	if (trustProxy) {
		const forwardedFor = request.headers.get("x-forwarded-for");
		if (forwardedFor) {
			const firstIP = forwardedFor.split(",")[0].trim();
			return firstIP;
		}

		const realIP = request.headers.get("x-real-ip");
		if (realIP) {
			return realIP.trim();
		}
	}

	return "unknown";
}

export function extractUserAgent(request: Request): string {
	const ua = request.headers.get("user-agent");

	if (!ua) {
		return "unknown";
	}

	const MAX_UA_LENGTH = 512;
	return ua.length > MAX_UA_LENGTH ? ua.slice(0, MAX_UA_LENGTH) : ua;
}

export async function validateFingerprint(session: Session, request: Request): Promise<boolean> {
	const storedFingerprint = getStoredFingerprint(session);

	if (!storedFingerprint) {
		const { ipAddress, userAgent } = extractRequestInfo(request);
		void createAuditLog({
			userId: toNumericUserId((session as any)?.user?.id),
			event: "token_rejected",
			ipAddress,
			userAgent,
			metadata: {
				reason: "missing_session_fingerprint",
				...(previewToken((session as any)?.token)
					? { sessionTokenPreview: previewToken((session as any)?.token) }
					: {}),
			},
		});

		return false;
	}

	const currentIP = extractIP(request);
	const currentUserAgent = extractUserAgent(request);
	const currentFingerprint = await generateFingerprint(currentIP, currentUserAgent);

	const storedBytes = new TextEncoder().encode(storedFingerprint);
	const currentBytes = new TextEncoder().encode(currentFingerprint);

	if (storedBytes.length !== currentBytes.length) {
		void createAuditLog({
			userId: toNumericUserId((session as any)?.user?.id),
			event: "token_rejected",
			ipAddress: currentIP,
			userAgent: currentUserAgent,
			metadata: {
				reason: "fingerprint_mismatch",
				expectedFingerprint: storedFingerprint,
				actualFingerprint: currentFingerprint,
				...(previewToken((session as any)?.token)
					? { sessionTokenPreview: previewToken((session as any)?.token) }
					: {}),
			},
		});

		return false;
	}

	const result = (crypto as any).timingSafeEqual(storedBytes, currentBytes);
	if (result !== true) {
		void createAuditLog({
			userId: toNumericUserId((session as any)?.user?.id),
			event: "token_rejected",
			ipAddress: currentIP,
			userAgent: currentUserAgent,
			metadata: {
				reason: "fingerprint_mismatch",
				expectedFingerprint: storedFingerprint,
				actualFingerprint: currentFingerprint,
				...(previewToken((session as any)?.token)
					? { sessionTokenPreview: previewToken((session as any)?.token) }
					: {}),
			},
		});
	}
	return result === true;
}
