import type { AuthSession } from '@/lib/auth-schema';
import { adoptSession, coreApi } from '@/lib/core-api';

/** Each of these keeps the access token it is answered with; the refresh cookie is set by the service. */
export async function login(email: string, password: string): Promise<AuthSession> {
  return adoptSession((await coreApi.post('/auth/login', { email, password })).data);
}

export async function logout(): Promise<void> {
  await coreApi.post('/auth/logout');
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthSession> {
  return adoptSession((await coreApi.post('/auth/change-password', { currentPassword, newPassword })).data);
}
