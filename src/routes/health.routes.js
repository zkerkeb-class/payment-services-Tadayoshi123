const express = require('express');
const { getHealth } = require('../controllers/health.controller');

const router = express.Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Vérifie l'état de santé du service de paiement
 *     tags: [Health]
 *     description: Renvoie un statut simple indiquant que le service est en cours d'exécution.
 *     responses:
 *       200:
 *         description: Le service est sain.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: UP
 *                 message:
 *                   type: string
 *                   example: Payment service is running
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/', getHealth);

module.exports = router; 