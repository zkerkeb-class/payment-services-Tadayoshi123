const express = require('express');

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Endpoints pour recevoir les événements de services externes (Stripe).
 */

/**
 * Crée et retourne le routeur pour les webhooks.
 * @param {import('../controllers/payment.controller')} paymentController - Le contrôleur de paiement.
 * @returns {express.Router} Le routeur Express.
 */
const webhookRoutes = (paymentController) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/v1/webhooks/stripe:
   *   post:
   *     summary: Gère les événements webhook entrants de Stripe
   *     tags: [Webhooks]
   *     description: |
   *       Endpoint public qui écoute les événements envoyés par Stripe.
   *       La sécurité est assurée par la vérification de la signature HMAC-SHA256 fournie dans l'en-tête `stripe-signature`.
   *       **Important** : Ce endpoint doit recevoir le corps de la requête brut (raw JSON).
   *     requestBody:
   *       description: Charge utile de l'événement Stripe. Le contenu exact varie en fonction du type d'événement.
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               id:
   *                 type: string
   *                 example: evt_1P6JTnRxkxM2gVjTDvA39xWc
   *               object:
   *                 type: string
   *                 example: event
   *               type:
   *                 type: string
   *                 example: checkout.session.completed
   *               data:
   *                 type: object
   *     responses:
   *       200:
   *         description: Événement reçu et traité avec succès.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 received:
   *                   type: boolean
   *                   example: true
   *       400:
   *         description: Erreur, par exemple une signature de webhook invalide.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  // Note: Le middleware express.raw() est appliqué directement dans server.js pour cette route spécifique.
  router.post('/stripe', paymentController.handleStripeWebhook);

  return router;
};

module.exports = webhookRoutes; 