const pino = require('pino');

const pinoConfig = {
  level: process.env.LOG_LEVEL || 'info',
};

// En développement, on utilise pino-pretty pour une meilleure lisibilité.
if (process.env.NODE_ENV === 'development') {
  pinoConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
      ignore: 'pid,hostname',
    },
  };
}

const logger = pino(pinoConfig);

module.exports = logger; 