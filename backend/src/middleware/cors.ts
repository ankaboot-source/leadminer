import cors, { CorsOptions } from 'cors';
import ENV from '../config';

function resolveAllowedOrigins(): string[] {
  const origins = [ENV.FRONTEND_HOST].filter(Boolean);
  const host = ENV.FRONTEND_HOST;

  // Tolerate the 127.0.0.1 form of a localhost FRONTEND_HOST so local dev
  // (and browser E2E) does not fail CORS when the frontend is reached via
  // 127.0.0.1 instead of localhost. Never broadens past the configured host.
  try {
    const { hostname } = new URL(host);
    if (hostname === 'localhost') {
      const loopback = new URL(host);
      loopback.hostname = '127.0.0.1';
      origins.push(loopback.toString().replace(/\/$/, ''));
    }
  } catch {
    // Leave origins as-is if FRONTEND_HOST is not a parseable URL.
  }

  return origins;
}

const allowedOrigins = resolveAllowedOrigins();

const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  methods: 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  allowedHeaders: [
    'Authorization',
    'X-Requested-With',
    'Content-type',
    'x-sb-jwt',
    'last-event-id'
  ],
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204,
  credentials: true
};
const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
