import cors, { CorsOptions } from 'cors';
import ENV from '../config';

const allowedOrigins = ENV.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());

const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  methods: 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Campaign-Id',
    'X-Mock-Token'
  ],
  optionsSuccessStatus: 200,
  credentials: true
};

const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
