const { asyncHandler, AppError, PaymentErrorCodes } = require('../middlewares/errorHandler');
const dbClient = require('../services/db-client');

class PaymentController {
  constructor(stripeService) {
    if (!stripeService) {
      throw new Error('StripeService is mandatory for PaymentController.');
    }
    this.stripeService = stripeService;
    // Bind 'this' pour les méthodes qui seront utilisées comme middlewares/handlers
    this.createCheckoutSession = this.createCheckoutSession.bind(this);
    this.createPortalSession = this.createPortalSession.bind(this);
    this.handleStripeWebhook = this.handleStripeWebhook.bind(this);
    this.getSubscription = this.getSubscription.bind(this);
  }

  /**
   * @description Crée une session de paiement Stripe
   * @route POST /api/v1/checkout-sessions
   * @access Privé
   */
  createCheckoutSession = asyncHandler(async (req, res) => {
    const { priceId, successUrl, cancelUrl } = req.body;
    const userId = req.user?.sub;

    if (!priceId || !successUrl || !cancelUrl) {
      throw new AppError('priceId, successUrl, and cancelUrl are required.', 400, PaymentErrorCodes.VALIDATION_ERROR);
    }
    if (!userId) {
      throw new AppError('User not authenticated.', 401, PaymentErrorCodes.UNAUTHORIZED);
    }

    const userData = await dbClient.getUserById(userId);
    if (!userData) {
      throw new AppError('User not found.', 404, PaymentErrorCodes.USER_NOT_FOUND);
    }
    
    const customer = await this.stripeService.createCustomer(userId, userData);
    const session = await this.stripeService.createCheckoutSession(customer.id, priceId, successUrl, cancelUrl);

    res.status(200).json({ sessionId: session.id, url: session.url });
  });

  /**
   * @description Crée une session de portail client Stripe pour gérer un abonnement
   * @route POST /api/v1/portal-sessions
   * @access Privé
   */
  createPortalSession = asyncHandler(async (req, res) => {
    const { returnUrl } = req.body;
    const userId = req.user?.sub;

    if (!returnUrl) {
      throw new AppError('returnUrl is required.', 400, PaymentErrorCodes.VALIDATION_ERROR);
    }
    if (!userId) {
      throw new AppError('User not authenticated.', 401, PaymentErrorCodes.UNAUTHORIZED);
    }

    const userData = await dbClient.getUserById(userId);
    if (!userData) {
      throw new AppError('User not found.', 404, PaymentErrorCodes.USER_NOT_FOUND);
    }
    if (!userData.stripeCustomerId) {
      throw new AppError("Cet utilisateur n'a pas d'abonnement à gérer.", 404, PaymentErrorCodes.CUSTOMER_NOT_FOUND);
    }

    const session = await this.stripeService.createPortalSession(userData.stripeCustomerId, returnUrl);
    res.status(200).json({ url: session.url });
  });

  /**
   * @description Récupère l'abonnement actif de l'utilisateur
   * @route GET /api/v1/subscription
   * @access Privé
   */
  getSubscription = asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
      throw new AppError('User not authenticated.', 401, PaymentErrorCodes.UNAUTHORIZED);
    }

    const userData = await dbClient.getUserById(userId);
    if (!userData) {
      throw new AppError('User not found.', 404, PaymentErrorCodes.USER_NOT_FOUND);
    }

    if (!userData.stripeCustomerId) {
      // Pas une erreur, l'utilisateur n'a simplement pas d'abonnement.
      return res.status(200).json({ subscription: null });
    }

    const subscription = await this.stripeService.getActiveSubscription(userData.stripeCustomerId);

    res.status(200).json({ subscription });
  });

  /**
   * @description Gère les webhooks entrants de Stripe
   * @route POST /api/v1/webhooks/stripe
   * @access Public (vérifié par signature Stripe)
   */
  handleStripeWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      throw new AppError('Stripe signature is missing.', 400, PaymentErrorCodes.STRIPE_SIGNATURE_INVALID);
    }

    const event = this.stripeService.constructWebhookEvent(req.rawBody, signature);
    await this.stripeService.handleWebhook(event);

    res.status(200).json({ received: true });
  });
}

module.exports = PaymentController; 