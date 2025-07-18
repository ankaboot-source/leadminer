import { createLogger, format, transports } from 'winston';
import LokiTransport from 'winston-loki';
import ENV from '../config';

function initLogger() {
  const commonFormat = format.combine(
    format.timestamp({
      format: 'MMM-DD-YYYY HH:mm:ss'
    }),
    format.errors({ stack: true })
  );

  const loggerConfiguration = {
    level: ENV.LEADMINER_API_LOG_LEVEL,
    handleExceptions: true,
    handleRejections: true
  };

  if (ENV.GRAFANA_LOKI_HOST) {
    return createLogger({
      ...loggerConfiguration,
      transports: [
        new LokiTransport({
          host: ENV.GRAFANA_LOKI_HOST,
          labels: { app: ENV.APP_NAME },
          json: true,
          replaceTimestamp: true,
          format: format.combine(commonFormat, format.json()),
          gracefulShutdown: true,
          // eslint-disable-next-line no-console
          onConnectionError: (err) => console.error(err)
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
