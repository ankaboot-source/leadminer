const cors = require('cors');
const { allowedOrigins } = require('../config/server.config');

const corsOptions = {
  origin: allowedOrigins,
  methods: 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  allowedHeaders: 'X-Requested-With,Content-type,X-imap-login',
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204,
  credentials: true,
  allRoutes: true
};
const corsMiddleware = cors(corsOptions);

module.exports = {
  corsMiddleware
};
