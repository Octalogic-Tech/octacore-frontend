import { api } from './api';

describe('api', () => {
  it('points at the json-server mock on port 3002 by default', () => {
    expect(api.defaults.baseURL).toBe('http://localhost:3002');
  });
});
