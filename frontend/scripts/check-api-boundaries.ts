import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const FRONTEND_ROOT = process.cwd();
const SRC_ROOT = path.join(FRONTEND_ROOT, 'src');
const ROUTES_ROOT = path.join(SRC_ROOT, 'routes');
const SERVICES_ROOT = path.join(SRC_ROOT, 'lib', 'services');
const PROXY_ROOT = path.join(ROUTES_ROOT, 'api', 'proxy');

type Violation = {
	rule: string;
	file: string;
	message: string;
};

async function listFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				return listFiles(fullPath);
			}
			return [fullPath];
		})
	);

	return files.flat();
}

function isRouteLoadOrAction(filePath: string): boolean {
	return /\+(page|layout)(\.server)?\.ts$/.test(filePath);
}

function relative(filePath: string): string {
	return path.relative(FRONTEND_ROOT, filePath).replace(/\\/g, '/');
}

async function main(): Promise<void> {
	const allSrcFiles = (await listFiles(SRC_ROOT)).filter((file) => /\.(ts|js)$/.test(file));
	const violations: Violation[] = [];

	for (const file of allSrcFiles) {
		const normalizedFile = file.replace(/\\/g, '/');
		const content = await readFile(file, 'utf8');
		const rel = relative(file);
		const inProxy = file.startsWith(PROXY_ROOT);
		const inServices = file.startsWith(SERVICES_ROOT);
		const inServerHelpers = normalizedFile.includes('/src/lib/server/');
		const inRoutes = file.startsWith(ROUTES_ROOT);

		if (inRoutes && !inProxy && isRouteLoadOrAction(file)) {
			if (/['"`]\/api\//.test(content) || /https?:\/\//.test(content)) {
				violations.push({
					rule: 'no-endpoint-literals-in-views',
					file: rel,
					message: 'Views/load/actions must call services, not endpoint literals.'
				});
			}
		}

		if (!inServices && /['"`]\/api\/proxy\//.test(content)) {
			violations.push({
				rule: 'proxy-callers-must-be-services',
				file: rel,
				message: 'Only service modules may reference /api/proxy/* paths.'
			});
		}

		if (!inProxy && !inServerHelpers && /PUBLIC_BACKEND_URL/.test(content)) {
			violations.push({
				rule: 'backend-callers-must-be-proxy',
				file: rel,
				message: 'Only proxy handlers/server helpers may reference backend URL env.'
			});
		}
	}

	if (violations.length === 0) {
		console.log('check-api-boundaries: PASS');
		return;
	}

	console.error('check-api-boundaries: FAIL');
	for (const violation of violations) {
		console.error(`- [${violation.rule}] ${violation.file}: ${violation.message}`);
	}

	process.exit(1);
}

void main();
