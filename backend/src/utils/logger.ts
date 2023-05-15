import { createLogger, format, transports } from 'winston';
import LokiTransport from 'winston-loki';
import { GRAFANA_LOKI_HOST, LEADMINER_API_LOG_LEVEL } from '../config';

function initLogger() {
  const commonFormat = format.combine(
    format.timestamp({
      format: 'MMM-DD-YYYY HH:mm:ss'
    }),
    format.errors({ stack: true })
  );

  const loggerConfiguration = {
    level: LEADMINER_API_LOG_LEVEL,
    handleExceptions: true,
    handleRejections: true
  };

  if (GRAFANA_LOKI_HOST && GRAFANA_LOKI_HOST !== '') {
    return createLogger({
      ...loggerConfiguration,
      transports: [
        new LokiTransport({
          host: GRAFANA_LOKI_HOST,
          labels: { app: 'leadminer' },
          format: format.combine(commonFormat, format.json())
        })
      ]
    });
  }

  return createLogger({
    ...loggerConfiguration,
    transports: [
      new transports.Console({
        format: format.combine(
          commonFormat,
          format.cli(),
          format.printf(
            ({ timestamp, level, message, ...args }) =>
              `[${timestamp}] ${level}: ${message} | ${JSON.stringify(args)}`
          )
        )
      })
    ]
  });
}

export default initLogger();
