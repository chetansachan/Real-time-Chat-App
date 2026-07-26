import { request } from '@/lib/api/client';
import type { AuthResponse, PublicUser } from '@/lib/api/types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

export function loginRequest(input: LoginInput): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', { method: 'POST', body: input, auth: false });
}

export function registerRequest(input: RegisterInput): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', { method: 'POST', body: input, auth: false });
}

export function logoutRequest(): Promise<{ success: true }> {
  return request<{ success: true }>('/auth/logout', { method: 'POST' });
}

export function fetchMe(): Promise<PublicUser> {
  return request<PublicUser>('/users/me');
}
