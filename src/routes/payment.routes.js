const express = require('express');
const { authenticate } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Gestion des paiements et abonnements via Stripe.
 *
 * components:
 *   schemas:
 *     CheckoutSessionRequest:
 *       type: object
 *       required:
 *         - priceId
 *         - successUrl
 *         - cancelUrl
 *       properties:
 *         priceId:
 *           type: string
 *           description: "L'ID du plan tarifaire Stripe (ex: price_12345)"
 *         successUrl:
 *           type: string
 *           format: uri
 *           description: "URL de redirection en cas de succès"
 *         cancelUrl:
 *           type: string
 *           format: uri
 *           description: "URL de redirection en cas d'annulation"
 *     PortalSessionRequest:
 *        type: object
 *        required:
 *          - returnUrl
 *        properties:
 *          returnUrl:
 *            type: string
 *            format: uri
 *            description: "URL de redirection après la session du portail"
 */

/**
 * Crée et retourne le routeur pour les paiements.
 * @param {import('../controllers/payment.controller')} paymentController - Le contrôleur de paiement.
 * @returns {express.Router} Le routeur Express.
 */
const paymentRoutes = (paymentController) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/v1/payments/checkout-sessions:
   *   post:
   *     summary: Crée une session de paiement Stripe
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CheckoutSessionRequest'
   *     responses:
   *       200:
   *         description: Session créée avec succès.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 sessionId:
   *                   type: string
   *                 url:
   *                   type: string
   *       400:
   *         description: Requête invalide (paramètres manquants).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       401:
   *         description: Non autorisé (token invalide ou manquant).
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Utilisateur non trouvé.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post('/checkout-sessions', authenticate, paymentController.createCheckoutSession);

  /**
   * @swagger
   * /api/v1/payments/subscription:
   *   get:
   *     summary: Récupère l'abonnement actif de l'utilisateur
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Statut de l'abonnement récupéré.
   *         content:
   *           application/json:
   *             schema:
   *                $ref: '#/components/schemas/SubscriptionResponse'
   *       401:
   *         description: Non autorisé.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/subscription', authenticate, paymentController.getSubscription);

  /**
   * @swagger
   * /api/v1/payments/portal-sessions:
   *   post:
   *     summary: Crée une session de portail client Stripe
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/PortalSessionRequest'
   *     responses:
   *       200:
   *         description: Session de portail créée avec succès.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 url:
   *                   type: string
   *       401:
   *         description: Non autorisé.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: "Utilisateur non trouvé ou n'a pas de client Stripe associé."
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post('/portal-sessions', authenticate, paymentController.createPortalSession);

  return router;
};

module.exports = paymentRoutes; 