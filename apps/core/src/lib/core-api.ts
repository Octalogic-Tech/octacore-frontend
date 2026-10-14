import axios from 'axios';
import { z } from 'zod';

/**
 * The FastAPI core service (octacore-backend): base path /api/v1, every response in the envelope
 * { statusCode, message, data, meta }, camelCase keys, open CORS. The json-server mock lives behind `api`.
 */
export const coreApi = axios.create({
  baseURL: (import.meta.env.VITE_CORE_API_URL as string | undefined) ?? 'http://localhost:5001/api/v1',
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
