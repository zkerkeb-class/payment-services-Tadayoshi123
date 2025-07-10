const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');
const logger = require('../src/config/logger');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SupervIA - Payment Service API',
      version: '1.0.0',
      description:
        'Ce service gère les abonnements et les paiements via Stripe. ' +
        'Il fournit des endpoints pour créer des sessions de paiement, gérer les abonnements, ' +
        'et consulter le statut des paiements. Sécurisé par JWT.',
      contact: {
        name: 'Support Technique SupervIA',
        email: 'support@supervia.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3006}`,
        description: 'Serveur de développement local',
      },
      {
        url: 'https://api.supervia.com/payments',
        description: 'Serveur de production',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: "Token d'accès JWT (RS256) obtenu auprès du service d'authentification, contenant l'identifiant de l'utilisateur.",
        },
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              code: { type: 'string' },
              details: { type: 'object', nullable: true }
            }
          }
        }
      },
      CheckoutSessionRequest: {
        type: 'object',
        required: ['priceId', 'successUrl', 'cancelUrl'],
        properties: {
          priceId: { type: 'string', description: "L'ID du plan tarifaire Stripe (ex: price_12345)", example: 'price_1P6JSKRxkxM2gVjTwzZqF9aA' },
          successUrl: { type: 'string', format: 'uri', description: "URL de redirection en cas de succès", example: 'http://localhost:4000/payment/success' },
          cancelUrl: { type: 'string', format: 'uri', description: "URL de redirection en cas d'annulation", example: 'http://localhost:4000/payment/cancel' }
        }
      },
      PortalSessionRequest: {
        type: 'object',
        required: ['returnUrl'],
        properties: {
          returnUrl: { type: 'string', format: 'uri', description: "URL de redirection après la session du portail", example: 'http://localhost:4000/dashboard/settings' }
        }
      },
      SubscriptionResponse: {
          type: 'object',
          properties: {
            subscription: {
              type: 'object',
              nullable: true,
              description: "L'objet abonnement Stripe ou null si aucun abonnement actif.",
              example: { id: "sub_1P6JSLRxkxM2gVjT7Nqf8c3T", status: "active", /* ... autres champs */ }
            }
          }
      }
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Les fichiers contenant les annotations JSDoc pour Swagger
  apis: ['./src/routes/*.js'],
};

try {
  const swaggerSpec = swaggerJsdoc(options);
  const swaggerJsonPath = path.join(__dirname, '../src/swagger.json');

  fs.writeFileSync(swaggerJsonPath, JSON.stringify(swaggerSpec, null, 2));

  logger.info(`Documentation Swagger générée avec succès : ${swaggerJsonPath}`);
} catch (error) {
  logger.error('Erreur lors de la génération de la documentation Swagger:', error);
  process.exit(1);
} 