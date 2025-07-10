const promClient = require('prom-client');
const logger = require('../config/logger');

const register = new promClient.Registry();
const prefix = 'payment_service_';

promClient.collectDefaultMetrics({ register, prefix });

const httpRequestCounter = new promClient.Counter({
  name: prefix + 'http_requests_total',
  help: 'Nombre total de requêtes HTTP reçues',
  labelNames: ['method', 'route', 'code'],
});
register.registerMetric(httpRequestCounter);

const httpRequestDurationHistogram = new promClient.Histogram({
  name: prefix + 'http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'code'],
  buckets: promClient.exponentialBuckets(0.001, 2, 15),
});
register.registerMetric(httpRequestDurationHistogram);

// Métrique pour les paiements Stripe
const stripePaymentsCounter = new promClient.Counter({
  name: prefix + 'stripe_payments_total',
  help: 'Nombre total de paiements Stripe traités',
  labelNames: ['type', 'status', 'currency'], // type: charge, subscription, etc.
});
register.registerMetric(stripePaymentsCounter);

const metricsMiddleware = (req, res, next) => {
  const end = httpRequestDurationHistogram.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    const code = res.statusCode;
    httpRequestCounter.inc({ route, method: req.method, code });
    end({ route, method: req.method, code });
  });
  next();
};

const metricsEndpoint = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    logger.error('Erreur lors de la récupération des métriques Prometheus', ex);
    res.status(500).end(ex);
  }
};

const incrementStripePayments = (type, status, currency) => {
  stripePaymentsCounter.inc({ type, status, currency });
};

module.exports = {
  metricsMiddleware,
  metricsEndpoint,
  incrementStripePayments,
}; 