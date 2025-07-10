const pinoHttp = require('pino-http');
const logger = require('../config/logger');
const crypto = require('crypto');

const loggerMiddleware = pinoHttp({
  logger,

  // Génère un ID unique pour chaque requête
  genReqId: function (req, res) {
    const existingId = req.id ?? req.headers["x-request-id"];
    if (existingId) return existingId;
    const id = crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },

  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn'
    } else if (res.statusCode >= 500 || err) {
      return 'error'
    }
    return 'info'
  },

  customSuccessMessage: function (req, res) {
    if (res.statusCode === 404) {
      return `Resource not found`
    }
    return `${req.method} ${req.url} completed`
  },
});

module.exports = loggerMiddleware; 