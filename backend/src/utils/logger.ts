import { createLogger, format, transports } from 'winston';
import LokiTransport from 'winston-loki';
import ENV from '../config';

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(value, (_key, currentValue: unknown) => {
    if (currentValue instanceof Error) {
      return {
        name: currentValue.name,
        message: currentValue.message,
        stack: currentValue.stack
      };
    }

    if (typeof currentValue === 'object' && currentValue !== null) {
      if (seen.has(currentValue)) {
        return '[Circular]';
      }

      seen.add(currentValue);
    }

    return currentValue;
  });
}

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
              `[${timestamp}] ${level}: ${message} | ${safeStringify(args)}`
          )
        )
      })
    ]
  });
}

export default initLogger();
