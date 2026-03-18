const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000';

interface APIError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    const error = data as APIError;
    throw new Error(error.message || 'An error occurred');
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: 'POST', body }),
  patch: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: 'PATCH', body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export type BadgeType = 'iron' | 'bronze' | 'silver' | 'gold' | 'diamond';

export interface UserBadge {
  id: number;
  user_id: number;
  badge_type: BadgeType;
  earned_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  rank: BadgeType;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
}

export interface PublicUserProfile {
  id: number;
  username: string;
  avatar_url?: string;
  bio?: string;
  rank: BadgeType;
  public_link_count: number;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}
