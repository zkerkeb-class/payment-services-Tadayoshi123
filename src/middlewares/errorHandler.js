const logger = require('../config/logger');

class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const PaymentErrorCodes = {
  // Erreurs Stripe
  STRIPE_ERROR: 'STRIPE_ERROR',
  STRIPE_SIGNATURE_INVALID: 'STRIPE_SIGNATURE_INVALID',
  CHECKOUT_SESSION_CREATION_FAILED: 'CHECKOUT_SESSION_CREATION_FAILED',
  PORTAL_SESSION_CREATION_FAILED: 'PORTAL_SESSION_CREATION_FAILED',
  CARD_ERROR: 'CARD_ERROR',
  STRIPE_INVALID_REQUEST: 'STRIPE_INVALID_REQUEST',
  STRIPE_API_ERROR: 'STRIPE_API_ERROR',
  STRIPE_CONNECTION_ERROR: 'STRIPE_CONNECTION_ERROR',
  STRIPE_AUTHENTICATION_ERROR: 'STRIPE_AUTHENTICATION_ERROR',

  // Erreurs de paiement
  PAYMENT_INTENT_FAILED: 'PAYMENT_INTENT_FAILED',
  SUBSCRIPTION_FAILED: 'SUBSCRIPTION_FAILED',
  CUSTOMER_CREATION_FAILED: 'CUSTOMER_CREATION_FAILED',
  INVOICE_ERROR: 'INVOICE_ERROR',

  // Erreurs de validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',

  // Erreurs internes
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!error.isOperational) {
    logger.error('Erreur non gérée interceptée:', error);
    error = new AppError(
      process.env.NODE_ENV === 'production' ? 'Une erreur interne est survenue' : err.message,
      500,
      'INTERNAL_ERROR'
    );
  } else {
    logger.warn(`Erreur opérationnelle: ${error.message}`, {
      code: error.errorCode,
      details: error.details,
      url: req.originalUrl,
    });
  }

  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.errorCode,
      details: error.details,
    },
  };

  res.status(error.statusCode).json(response);
};

const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route non trouvée: ${req.method} ${req.originalUrl}`,
    404,
    'NOT_FOUND'
  );
  next(error);
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  PaymentErrorCodes,
  errorHandler,
  notFoundHandler,
  asyncHandler,
}; 