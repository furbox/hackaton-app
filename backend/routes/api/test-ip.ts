import { extractIP, extractUserAgent } from "../../middleware/auth/fingerprint.js";

export async function GET(request: Request) {
	const ip = extractIP(request);
	const userAgent = extractUserAgent(request);

	return Response.json({
		success: true,
		message: "IP extraction test endpoint",
		data: {
			ip,
			userAgent,
			trustProxy: process.env.TRUST_PROXY === "true",
			timestamp: new Date().toISOString(),
		},
	});
}
