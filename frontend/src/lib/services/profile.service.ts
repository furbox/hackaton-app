import { http, type ApiResponse } from './http';

export interface PublicProfileResponse {
	username: string;
	avatarUrl: string | null;
	bio: string | null;
	rankId: number;
	totalLinks: number;
	totalViews: number;
	totalLikes: number;
}

export interface UpdateProfileInput {
	username?: string;
	bio?: string;
	avatarUrl?: string;
}

export interface UpdateProfileResponse {
	username: string;
	bio: string | null;
	avatarUrl: string | null;
}

export interface ChangePasswordInput {
	currentPassword: string;
	newPassword: string;
}

export class ProfileService {
	async getPublicProfile(username: string): Promise<ApiResponse<PublicProfileResponse>> {
		return http.get<PublicProfileResponse>(`/api/users/${username}`);
	}

	async updateProfile(input: UpdateProfileInput, cookies?: string): Promise<ApiResponse<UpdateProfileResponse>> {
		return http.put<UpdateProfileResponse>('/api/users/me', input, { cookies });
	}

	async changePassword(input: ChangePasswordInput, cookies?: string): Promise<ApiResponse<{ success: true }>> {
		return http.put<{ success: true }>('/api/users/me/password', input, { cookies });
	}
}

export const profileService = new ProfileService();
