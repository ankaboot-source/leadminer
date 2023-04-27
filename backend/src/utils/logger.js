import { createLogger, format, transports } from 'winston';
import { LEADMINER_API_LOG_LEVEL } from '../config';

const { combine, timestamp, json } = format;

const loggerConfiguration = {
  format: combine(timestamp({ format: 'MMM-DD-YYYY HH:mm:ss' }), json()),
  level: LEADMINER_API_LOG_LEVEL,
  handleExceptions: true,
  handleRejections: true
};

const logger = createLogger({
  ...loggerConfiguration,
  transports: [new transports.Console()]
});

export default logger;
