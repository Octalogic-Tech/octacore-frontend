import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { userRows } from './fixtures/users';

export interface FakeReply {
  status: number;
  data?: unknown;
}

type Handler = (config: InternalAxiosRequestConfig) => FakeReply | Promise<FakeReply>;

export type FakeAdapter = AxiosAdapter & { calls: InternalAxiosRequestConfig[] };

/** An axios adapter that answers from a function, so the interceptors run for real and no request leaves the test. */
export function fakeAdapter(handler: Handler): FakeAdapter {
  const calls: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config);
    const { status, data } = await handler(config);
    const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null, response);
    }
    return response;
  };
  return Object.assign(adapter, { calls });
}

export const envelope = (data: unknown, statusCode = 200) => ({ statusCode, message: 'ok', data, meta: null });

/** What POST /auth/login, /auth/refresh and /auth/change-password answer with. */
export const sessionEnvelope = (accessToken: string) =>
  envelope({ accessToken, expiresIn: 900, user: userRows[0] });
