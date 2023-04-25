import cors from 'cors';
import { ALLOWED_ORIGINS } from '../config';

const corsOptions = {
  origin: ALLOWED_ORIGINS,
  methods: 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  allowedHeaders: 'X-Requested-With,Content-type,X-imap-login',
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204,
  credentials: true,
  allRoutes: true
};
const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
