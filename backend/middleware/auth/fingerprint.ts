import { createAuditLog } from "../../services/audit-log.service.js";
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
	let extractedIP: string | null = null;
	let source: string = "unknown";

	// Try X-Forwarded-For first (only if TRUST_PROXY is enabled)
	if (trustProxy) {
		const forwardedFor = request.headers.get("x-forwarded-for");
		if (forwardedFor) {
			const firstIP = forwardedFor.split(",")[0].trim();
			extractedIP = firstIP;
			source = "x-forwarded-for";
		}

		// Then try X-Real-IP
		if (!extractedIP) {
			const realIP = request.headers.get("x-real-ip");
			if (realIP) {
				extractedIP = realIP.trim();
				source = "x-real-ip";
			}
		}
	}

	// Local development fallback
	if (!extractedIP) {
		// Check if this is a local development request by parsing the URL
		try {
			const url = new URL(request.url);
			const hostname = url.hostname;

			// Common local development hostnames
			if (
				hostname === "localhost" ||
				hostname === "127.0.0.1" ||
				hostname === "::1" ||
				hostname.startsWith("127.") ||
				hostname.startsWith("192.168.") ||
				hostname.startsWith("10.") ||
				hostname.startsWith("172.16.")
			) {
				// Return IPv4 localhost for development
				extractedIP = "127.0.0.1";
				source = "localhost-detection";
			}
		} catch (error) {
			// URL parsing failed, fall through to unknown
			console.warn("[IP Extraction] Failed to parse request URL:", error);
		}
	}

	// Final fallback
	if (!extractedIP) {
		extractedIP = "unknown";
		source = "fallback";
	}

	// Log the extraction for debugging
	console.log(`[IP Extraction] IP: ${extractedIP}, Source: ${source}, TRUST_PROXY: ${trustProxy}`);

	return extractedIP;
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
		return true;
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
