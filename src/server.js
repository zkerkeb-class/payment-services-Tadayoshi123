// @/payment-services-Tadayoshi123/src/server.js
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const logger = require('./config/logger');
const loggerMiddleware = require('./middlewares/logger');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { metricsMiddleware, metricsEndpoint } = require('./middlewares/metrics');
const swaggerDocument = require('./swagger.json');

// Importation des services et contrôleurs
const StripeService = require('./services/stripe.service');
const PaymentController = require('./controllers/payment.controller');
const dbClient = require('./services/db-client');
const notificationService = require('./services/notification.service');

// Importation des routes
const paymentRoutes = require('./routes/payment.routes');
const healthRoutes = require('./routes/health.routes');
const webhookRoutes = require('./routes/webhook.routes');

const app = express();

// --- Initialisation des services ---
const stripeService = new StripeService(dbClient, notificationService);
const paymentController = new PaymentController(stripeService);

// --- Middlewares principaux ---
const corsOptions = {
  origin: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:4000').split(','),
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(helmet());
app.use(cors(corsOptions));
// N.B. Le webhook Stripe nécessite le corps brut de la requête, nous appliquons donc le parser JSON plus tard.

// --- Définitions des routes ---

// L'endpoint du webhook Stripe doit être enregistré AVANT express.json()
const apiRouter = express.Router();
const webhookRouter = express.Router();

// L'endpoint du webhook Stripe doit être enregistré AVANT express.json()
webhookRouter.use('/', express.raw({ type: 'application/json' }), webhookRoutes(paymentController));
app.use('/api/v1/webhooks', webhookRouter);

// Appliquer le parser JSON pour toutes les autres routes
app.use(express.json());

// Appliquer les middlewares utilitaires
app.use(loggerMiddleware);
app.use(metricsMiddleware);

// Route pour la documentation de l'API
if (process.env.ENABLE_SWAGGER === 'true') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Route pour les métriques
app.get('/metrics', metricsEndpoint);

// Routes de l'application
apiRouter.use('/health', healthRoutes);
apiRouter.use('/payments', paymentRoutes(paymentController));
app.use('/api/v1', apiRouter);

// --- Gestion des erreurs ---
app.use(notFoundHandler);
// pino-http (loggerMiddleware) inclut déjà des capacités de journalisation des erreurs
app.use(errorHandler);

const PORT = process.env.PORT || 3006;

app.listen(PORT, () => {
  logger.info(`💳 SupervIA Payment Service démarré avec succès!`);
  logger.info(`🌐 Serveur API écoutant sur: http://localhost:${PORT}`);
});

module.exports = app; 