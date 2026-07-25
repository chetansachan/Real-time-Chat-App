import { useAuthStore } from '@/stores/auth';
import type { AuthResponse } from './types';

const API_BASE = '/api';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Send the access token. Defaults to true. */
  auth?: boolean;
}

interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

let refreshPromise: Promise<AuthResponse | null> | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

async function parsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return (await response.json()) as unknown;
    } catch {
      return null;
    }
  }
  const text = await response.text();
  return text.length > 0 ? text : null;
}

function toApiError(response: Response, payload: unknown): ApiError {
  if (isRecord(payload)) {
    const body = payload as ErrorBody;
    if (body.error) {
      return new ApiError(
        body.error.code ?? 'INTERNAL',
        body.error.message ?? 'Something went wrong.',
        response.status,
        body.error.details,
      );
    }
  }
  const fallback =
    typeof payload === 'string' && payload.length > 0
      ? payload
      : `Request failed with status ${response.status}`;
  return new ApiError('INTERNAL', fallback, response.status);
}

/**
 * Single-flight refresh: concurrent 401s all wait for the same rotation.
 * The browser sends the httpOnly refresh cookie automatically.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!response.ok) return null;
        const session = (await response.json()) as AuthResponse;
        useAuthStore.getState().setSession(session);
        return session;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function requestWithRetry<T>(
  path: string,
  options: RequestOptions,
  allowRetry: boolean,
): Promise<T> {
  const { body, auth = true, headers, ...init } = options;
  const token = useAuthStore.getState().accessToken;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      'NETWORK',
      'Could not reach the server. Check your connection and try again.',
      0,
    );
  }

  if (response.status === 401 && auth && allowRetry) {
    const session = await refreshSession();
    if (!session) {
      useAuthStore.getState().clear();
      throw new ApiError('UNAUTHORIZED', 'Your session expired. Please sign in again.', 401);
    }
    return requestWithRetry<T>(path, options, false);
  }

  if (response.status === 204) return undefined as T;

  const payload = await parsePayload(response);
  if (!response.ok) throw toApiError(response, payload);
  return payload as T;
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return requestWithRetry<T>(path, options, true);
}

/** Restores the in-memory session from the refresh cookie on app boot. */
export async function bootstrapSession(): Promise<void> {
  const session = await refreshSession();
  if (!session) {
    useAuthStore.getState().setStatus('anonymous');
  }
}
