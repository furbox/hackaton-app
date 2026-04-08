import { jsonError } from "./errors.ts";
import { validateFingerprint } from "./fingerprint.ts";
import { getSession, type AuthResult, type Session } from "./session.ts";

export function getUserRole(session: Session): string {
	return (session.user as any).role || "user";
}

export function requireRole(session: Session, allowedRoles: string[]): boolean {
	const userRole = getUserRole(session);
	return allowedRoles.includes(userRole);
}

export function isAdmin(session: Session): boolean {
	return requireRole(session, ["admin"]);
}

export async function authenticated(request: Request): Promise<AuthResult> {
	const session = await getSession(request);
	if (!session) {
		return jsonError(401, "Invalid or missing session", "INVALID_SESSION");
	}

	const fingerprintValid = await validateFingerprint(session, request);
	if (!fingerprintValid) {
		return jsonError(
			403,
			"Session fingerprint mismatch - possible hijacking attempt",
			"FINGERPRINT_MISMATCH"
		);
	}

	return session;
}

export function requireRoleMiddleware(
	allowedRoles: string[]
): (request: Request) => Promise<AuthResult> {
	return async (request: Request) => {
		const session = await authenticated(request);
		if (session instanceof Response) {
			return session;
		}

		const hasRole = requireRole(session, allowedRoles);
		if (!hasRole) {
			return jsonError(
				403,
				`Requires one of these roles: ${allowedRoles.join(", ")}`,
				"INSUFFICIENT_PERMISSIONS"
			);
		}

		return session;
	};
}

export const requireAdmin = requireRoleMiddleware(["admin"]);
