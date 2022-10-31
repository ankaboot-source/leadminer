const cors = require('cors');

const corsOptions = {
  origin: '*',
  methods: 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  allowedHeaders: 'X-Requested-With,Content-type,X-imap-login',
  credentials: true
};
const corsMiddleware = cors(corsOptions);

module.exports = {
  corsMiddleware
};
