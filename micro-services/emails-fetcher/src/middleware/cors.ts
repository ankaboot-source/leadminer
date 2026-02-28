import cors, { CorsOptions } from 'cors';
import ENV from '../config';

const corsOptions: CorsOptions = {
  origin: [ENV.LEADMINER_API_HOST, 'http://localhost:3000'],
  methods: 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  allowedHeaders: ['Content-type', 'x-api-token'],
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204,
  credentials: true
};
const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
