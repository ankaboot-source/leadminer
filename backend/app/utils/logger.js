const { createLogger, format, transports } = require('winston');
const getLabel = function (callingModule) {
  const parts = callingModule.filename.split('/');
  return parts.pop();
};

module.exports = function (callingModule) {
  // Create and configure logger.
  return createLogger({
    transports: [
      new transports.File({
        filename: 'logs/server.log',
        format: format.combine(
          format.timestamp({ format: 'MMM-DD-YYYY HH:mm:ss' }),
          format.align(),
          format.label({ label: getLabel(callingModule) }),
          format.printf(
            (info) =>
              `${[info.timestamp]}  ${info.level}  ${info.message}  at  ${
                info.label
              }`
          )
        ),
      }),
      new transports.Console({
        format: format.combine(
          format.timestamp({ format: 'MMM-DD-YYYY HH:mm:ss' }),
          format.colorize({ all: true }),
          format.label({ label: getLabel(callingModule) }),
          format.simple(),
          format.printf(
            (info) =>
              `${[info.timestamp]}  [${info.level}]  ${info.message}    <<${
                info.label
              }>>`
          )
        ),
      }),
    ],
  });
};
