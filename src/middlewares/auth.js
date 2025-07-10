const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const logger = require('../config/logger');
const { AppError } = require('./errorHandler');

if (!process.env.AUTH_SERVICE_URL) {
  logger.warn('AUTH_SERVICE_URL is not set. Authentication middleware will not work.');
}

const authenticate = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${process.env.AUTH_SERVICE_URL}/jwks.json`
  }),
  audience: process.env.API_URL, // Le service qui reçoit le token (ce service)
  issuer: process.env.AUTH_SERVICE_URL, // Le service qui a émis le token
  algorithms: ['RS256'],
  requestProperty: 'user', // Le payload du token sera dans req.user
});


// Ce middleware est ajouté pour mapper le `sub` du token vers `req.user.id`
// pour être cohérent avec le reste de l'application.
const mapUser = (req, res, next) => {
    if (req.user && req.user.sub) {
        req.user.id = req.user.sub;
    }
    next();
};

const handleAuthError = (err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    logger.warn({ error: err }, 'Erreur d\'authentification JWT');
    next(new AppError(err.message, 401, 'AUTHENTICATION_ERROR'));
  } else {
    next(err);
  }
};

module.exports = {
    authenticate: [authenticate, mapUser, handleAuthError]
}; 