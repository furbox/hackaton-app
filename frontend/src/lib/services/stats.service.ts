import type { ApiResult, ServiceContext } from './contracts';
import { PROXY_ROUTES } from './contracts';
import { http } from './http';
import type { GlobalStatsDTO } from './links.service';

type RequestContext = ServiceContext | string | undefined;

function resolveContext(ctx: RequestContext): ServiceContext | undefined {
	if (!ctx) {
		return undefined;
	}

	if (typeof ctx === 'string') {
		return { cookies: ctx };
	}

	return ctx;
}

export interface UserStatsDTO {
	totalLinks: number;
	totalLikes: number;
	totalViews: number;
	rank: string;
}

export class StatsService {
	async getGlobalStats(ctx?: RequestContext): Promise<ApiResult<GlobalStatsDTO>> {
		return http.get<GlobalStatsDTO>(PROXY_ROUTES.stats.global, resolveContext(ctx));
	}

	async getMyStats(ctx?: RequestContext): Promise<ApiResult<UserStatsDTO>> {
		return http.get<UserStatsDTO>(PROXY_ROUTES.stats.me, resolveContext(ctx));
	}
}

export const statsService = new StatsService();
