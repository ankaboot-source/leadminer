import cors, { CorsOptions } from 'cors';
import ENV from '../config';

const corsOptions: CorsOptions = {
  origin: [ENV.FRONTEND_HOST],
  methods: 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  allowedHeaders: [
    'Authorization',
    'X-Requested-With',
    'Content-type',
    'X-imap-credentials'
  ],
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204,
  credentials: true
};
const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
