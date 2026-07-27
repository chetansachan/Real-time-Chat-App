import { request } from '@/lib/api/client';
import type { UserPreview } from '@/lib/api/types';

export function searchUsers(search: string, limit = 12): Promise<UserPreview[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());
  return request<UserPreview[]>(`/users?${params.toString()}`);
}
