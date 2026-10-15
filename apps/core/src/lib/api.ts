import axios from 'axios';

/** The one place that knows where the data lives. json-server today, the Nest core-service later. */
export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3002',
});
