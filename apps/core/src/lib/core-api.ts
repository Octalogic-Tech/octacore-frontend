import axios, { type InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';
import { authSessionSchema, type AuthSession } from '@/lib/auth-schema';
import { endSession, getAccessToken, setAccessToken } from '@/lib/session';

/**
 * The FastAPI core service (octacore-backend): base path /api/v1, every response in the envelope
 * { statusCode, message, data, meta }, camelCase keys. Credentials are sent so the refresh cookie (httpOnly, scoped
 * to /auth) travels; the access token goes in a bearer header. The json-server mock lives behind `api` and never
 * receives either.
 */
export const coreApi = axios.create({
  baseURL: (import.meta.env.VITE_CORE_API_URL as string | undefined) ?? 'http://localhost:5001/api/v1',
  withCredentials: true,
});

const envelopeSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  data: z.unknown(),
});

/**
 * Unwraps a success envelope and checks its data against a schema. Anything else throws, so a page shows its
 * error state instead of rendering a shape it does not understand (a bare array from the mock, say, or a
 * field the service renamed).
 */
export function unwrap<S extends z.ZodType>(body: unknown, dataSchema: S): z.output<S> {
  return dataSchema.parse(envelopeSchema.parse(body).data);
}

/** Parses a login, refresh or change-password answer, keeps its access token, and returns the session. */
export function adoptSession(body: unknown): AuthSession {
  const session = unwrap(body, authSessionSchema);
  setAccessToken(session.accessToken);
  return session;
}

coreApi.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

let refreshing: Promise<AuthSession> | null = null;

/**
 * Asks the service for a new session using the refresh cookie. Callers that overlap (React StrictMode mounting
 * twice, several requests failing together) share one request: the service rotates the cookie on every use, so a
 * second request with the old cookie would look like a stolen token.
 */
export function refreshSession(): Promise<AuthSession> {
  refreshing ??= coreApi
    .post('/auth/refresh')
    .then((response) => adoptSession(response.data))
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// The routes that answer 401 for reasons that refreshing cannot fix (wrong password, no cookie).
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

type RetryableRequest = InternalAxiosRequestConfig & { retriedAfterRefresh?: boolean };

coreApi.interceptors.response.use(undefined, async (error: unknown) => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) throw error;
  const request = error.config as RetryableRequest;
  if (request.retriedAfterRefresh || PUBLIC_AUTH_PATHS.includes(request.url ?? '')) throw error;
  request.retriedAfterRefresh = true;
  try {
    await refreshSession();
  } catch {
    endSession();
    throw error;
  }
  // The request interceptor stamps the new token on the retry.
  return coreApi.request(request);
});

/** The HTTP status of a failed request, when there was a response. */
export function statusOf(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

/**
 * The message the service wrote for a 409 (an email already in use, deleting yourself) or a 422 (a wrong current
 * password). Those are written for people; any other failure has no message worth showing.
 */
export function serviceMessage(error: unknown): string | undefined {
  const status = statusOf(error);
  if (status !== 409 && status !== 422) return undefined;
  const data = axios.isAxiosError(error) ? (error.response?.data as { message?: unknown } | undefined) : undefined;
  return typeof data?.message === 'string' ? data.message : undefined;
}
