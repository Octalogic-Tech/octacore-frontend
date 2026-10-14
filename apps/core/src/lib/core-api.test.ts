import { z } from 'zod';
import { coreApi, unwrap } from './core-api';

const item = z.object({ id: z.number() });

describe('coreApi', () => {
  it('points at the FastAPI core service by default', () => {
    expect(coreApi.defaults.baseURL).toBe('http://localhost:5001/api/v1');
  });
});

describe('unwrap', () => {
  it('returns the data of a well-formed envelope', () => {
    const body = { statusCode: 200, message: 'ok', data: [{ id: 1 }], meta: null };
    expect(unwrap(body, z.array(item))).toEqual([{ id: 1 }]);
  });

  it('drops fields the schema does not know', () => {
    const body = { statusCode: 200, message: 'ok', data: [{ id: 1, extra: 'x' }] };
    expect(unwrap(body, z.array(item))).toEqual([{ id: 1 }]);
  });

  it('rejects a bare array, which is what the json-server mock returns', () => {
    expect(() => unwrap([{ id: 1 }], z.array(item))).toThrow();
  });

  it('rejects an envelope whose data has the wrong shape', () => {
    const body = { statusCode: 200, message: 'ok', data: [{ id: 'one' }] };
    expect(() => unwrap(body, z.array(item))).toThrow();
  });

  it('rejects an envelope with no data', () => {
    expect(() => unwrap({ statusCode: 200, message: 'ok', data: null }, z.array(item))).toThrow();
  });
});
