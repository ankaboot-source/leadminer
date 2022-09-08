const { format, transports } = require('winston');
const winston = require('winston'),
  getLabel = function(callingModule) {
    const parts = callingModule.filename.split('/');

    return parts.pop();
  };
const config = require('config'),
  level = config.get('server.log_level');

module.exports =
  /* A function that returns a logger object. */
  function(callingModule) {
    // Create and configure logger.
    const logger = winston.createLogger({
      'transports': [
        new transports.File({
          'filename': 'logs/server.log',
          'format': format.combine(
            format.timestamp({ 'format': 'MMM-DD-YYYY HH:mm:ss' }),
            format.align(),
            format.label({ 'label': getLabel(callingModule) }),
            format.printf(
              (info) =>
                `${[ info.timestamp ]}  ${info.level}  ${info.message}  at  ${
                  info.label
                }`
            )
          ),
          'level': level
        }),

        new transports.Console({
          'format': format.combine(
            format.timestamp({ 'format': 'MMM-DD-YYYY HH:mm:ss' }),
            format.colorize({ 'all': true }),
            format.label({ 'label': getLabel(callingModule) }),
            format.simple(),
            format.printf(
              (info) =>
                `${[ info.timestamp ]}  [${info.level}]  ${info.message}    <<${
                  info.label
                }>>`
            )
          ),
          'level': level
        })
      ]
    });

    return logger;
  };
