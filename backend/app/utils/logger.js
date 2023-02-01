const { format, transports } = require('winston');
const winston = require('winston');
const { LEADMINER_API_LOG_LEVEL } = require('../config');

function getLabel(callingModule) {
  const parts = callingModule.filename.split('/');
  return parts.pop();
}

module.exports =
  /* A function that returns a logger object. */
  function (callingModule) {
    const commonFormats = [
      format.timestamp({ format: 'MMM-DD-YYYY HH:mm:ss' }),
      format.label({ label: getLabel(callingModule) }),
      format.metadata({
        fillExcept: ['message', 'level', 'timestamp', 'label']
      })
    ];

    // Create and configure logger.
    const logger = winston.createLogger({
      transports: [
        // new transports.File({
        //   filename: 'logs/server.log',
        //   format: format.combine(
        //     ...commonFormats,
        //     format.align(),
        //     format.printf(
        //       (info) =>
        //         `${[info.timestamp]}  ${info.level}  ${info.message}  at  ${
        //           info.label
        //         } | ${JSON.stringify(info.meta)}`
        //     )
        //   ),
        //   logLevel
        // }),

        new transports.Console({
          format: format.combine(
            ...commonFormats,
            format.colorize({ all: true }),
            format.simple(),
            format.printf(
              (info) =>
                `${[info.timestamp]}  [${info.level}]  ${info.message}    <<${
                  info.label
                }>> | ${JSON.stringify(info.metadata)}`
            )
          ),
          level: LEADMINER_API_LOG_LEVEL
        })
      ]
    });

    return logger;
  };
