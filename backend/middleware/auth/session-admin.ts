import { getDatabase } from "../../db/connection.js";
import { createAuditLog } from "../../services/audit-log.service.js";

export async function revokeUserSessions(
	userId: number,
	adminId: number,
	ipAddress: string,
	userAgent: string
): Promise<number> {
	const db = getDatabase();

	const stmt = db.prepare(`
    UPDATE sessions
    SET is_active = false
    WHERE user_id = ? AND is_active = true
  `);

	const result = stmt.run(userId);
	const revokedCount = result.changes;

	await createAuditLog({
		userId: adminId,
		event: "session_revoked",
		ipAddress,
		userAgent,
		metadata: {
			targetUserId: userId,
			revokedCount,
		},
	});

	return revokedCount;
}
