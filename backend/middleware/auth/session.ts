import { authConfig, type Session as ConfigSession } from "../../auth/config.js";
import { createAuditLog, extractRequestInfo } from "../../services/audit-log.service.js";
import { jsonError } from "./errors.ts";

export type Session = ConfigSession;
export type AuthResult = Session | Response;

function previewToken(value: unknown): string | undefined {
	if (typeof value !== "string" || value.length === 0) {
		return undefined;
	}
	return `${value.slice(0, 8)}...`;
}

function extractSessionToken(request: Request): string | null {
	const authHeader = request.headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		return authHeader.slice(7);
	}

	const cookieHeader = request.headers.get("Cookie");
	if (cookieHeader) {
		const cookies = cookieHeader.split(";").map((c) => c.trim());
		const sessionCookieNames = [
			"urlft_session",
			"better-auth.session_token",
			"__Secure-better-auth.session_token",
		];

		for (const cookieName of sessionCookieNames) {
			const sessionCookie = cookies.find((c) => c.startsWith(`${cookieName}=`));
			if (sessionCookie) {
				return sessionCookie.slice(cookieName.length + 1);
			}
		}
	}

	return null;
}

export async function getSession(request: Request): Promise<Session | null> {
	const token = extractSessionToken(request);
	if (!token) {
		return null;
	}

	try {
		const session = await authConfig.api.getSession({
			headers: request.headers,
		});

		if (!session) {
			const { ipAddress, userAgent } = extractRequestInfo(request);
			void createAuditLog({
				event: "token_rejected",
				ipAddress,
				userAgent,
				metadata: {
					reason: "invalid_or_expired_token",
					...(previewToken(token) ? { tokenPreview: previewToken(token) } : {}),
				},
			});
		}

		return session;
	} catch {
		const { ipAddress, userAgent } = extractRequestInfo(request);
		void createAuditLog({
			event: "token_rejected",
			ipAddress,
			userAgent,
			metadata: {
				reason: "invalid_or_expired_token",
				...(previewToken(token) ? { tokenPreview: previewToken(token) } : {}),
			},
		});

		return null;
	}
}

export async function requireAuth(request: Request): Promise<Session> {
	const session = await getSession(request);
	if (!session) {
		throw jsonError(401, "Authentication required", "NO_SESSION");
	}
	return session;
}
