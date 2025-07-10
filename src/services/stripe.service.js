const Stripe = require('stripe');
const logger = require('../config/logger');
const { AppError, PaymentErrorCodes } = require('../middlewares/errorHandler');
const { incrementStripePayments } = require('../middlewares/metrics');

class StripeService {
  constructor(dbClient, notificationService) {
    if (!process.env.STRIPE_API_KEY) {
      logger.warn('STRIPE_API_KEY is not set. StripeService will be disabled.');
      this.stripe = null;
    } else {
      this.stripe = new Stripe(process.env.STRIPE_API_KEY, {
        apiVersion: '2024-04-10',
        typescript: false,
      });
      logger.info('✅ StripeService initialisé.');
    }
    this.dbClient = dbClient;
    this.notificationService = notificationService;
  }

  /**
   * Vérifie si le service Stripe est actif.
   */
  _ensureStripeActive() {
    if (!this.stripe) {
      throw new AppError('Stripe service is not configured or disabled.', 503, PaymentErrorCodes.STRIPE_ERROR);
    }
  }

  /**
   * Crée ou récupère un client Stripe pour un utilisateur SupervIA.
   * Si l'utilisateur a déjà un stripeCustomerId, il le retourne.
   * Sinon, il crée un nouveau client dans Stripe et met à jour l'utilisateur local.
   * @param {string} userId - L'ID de l'utilisateur SupervIA.
   * @param {object} userData - Données de l'utilisateur (email, firstName, lastName, stripeCustomerId).
   * @returns {Promise<Stripe.Customer>} Le client Stripe.
   */
  async createCustomer(userId, userData) {
    this._ensureStripeActive();
    logger.info({ userId }, 'Recherche ou création d\'un client Stripe.');

    // Si l'utilisateur a déjà un ID client, on le récupère pour s'assurer qu'il existe bien côté Stripe.
    if (userData.stripeCustomerId) {
      try {
        const customer = await this.stripe.customers.retrieve(userData.stripeCustomerId);
        // On vérifie que le client n'a pas été supprimé dans Stripe
        if (!customer.deleted) {
          logger.info({ userId, customerId: userData.stripeCustomerId }, 'Client Stripe existant confirmé.');
          return customer;
        }
      } catch (error) {
        logger.warn({ err: error, userId }, 'Impossible de récupérer le client Stripe existant. Un nouveau sera créé.');
      }
    }

    try {
      const customer = await this.stripe.customers.create({
        email: userData.email,
        name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
        metadata: {
          supervia_user_id: userId,
        },
      });

      logger.info({ userId, customerId: customer.id }, 'Nouveau client Stripe créé.');

      // Mettre à jour l'utilisateur dans notre BDD avec le nouvel ID client Stripe
      // Note: this.dbClient doit être implémenté et injecté.
      await this.dbClient.updateUser(userId, { stripeCustomerId: customer.id });
      
      logger.info({ userId, customerId: customer.id }, 'Utilisateur SupervIA mis à jour avec l\'ID client Stripe.');

      return customer;
    } catch (error) {
      logger.error({ err: error, userId }, 'Erreur lors de la création du client Stripe.');
      throw new AppError('Impossible de créer le client de paiement.', 500, PaymentErrorCodes.CUSTOMER_CREATION_FAILED);
    }
  }

  /**
   * Crée une session de paiement Stripe (Checkout Session) pour un abonnement.
   * @param {string} customerId - L'ID du client Stripe.
   * @param {string} priceId - L'ID du prix (plan d'abonnement) Stripe.
   * @param {string} successUrl - URL de redirection en cas de succès.
   * @param {string} cancelUrl - URL de redirection en cas d'annulation.
   * @returns {Promise<Stripe.Checkout.Session>} La session de paiement.
   */
  async createCheckoutSession(customerId, priceId, successUrl, cancelUrl) {
    this._ensureStripeActive();
    logger.info({ customerId, priceId }, 'Création d\'une session de paiement Stripe pour un abonnement.');

    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription', // Important pour les abonnements
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
          // On peut ajouter des métadonnées qui seront utiles dans les webhooks
        }
      });

      logger.info({ sessionId: session.id }, 'Session de paiement créée avec succès.');
      return session;
    } catch (error) {
      logger.error({ err: error, customerId, priceId }, 'Erreur lors de la création de la session de paiement.');
      throw new AppError('Impossible de créer la session de paiement.', 500, PaymentErrorCodes.CHECKOUT_SESSION_CREATION_FAILED);
    }
  }

  /**
   * Crée une session pour le portail client Stripe, permettant à l'utilisateur de gérer son abonnement.
   * @param {string} customerId - L'ID du client Stripe.
   * @param {string} returnUrl - L'URL vers laquelle rediriger l'utilisateur après qu'il ait quitté le portail.
   * @returns {Promise<Stripe.BillingPortal.Session>} La session du portail client.
   */
  async createPortalSession(customerId, returnUrl) {
    this._ensureStripeActive();
    logger.info({ customerId }, 'Création d\'une session de portail client Stripe.');

    try {
      const portalSession = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      logger.info({ portalSessionId: portalSession.id }, 'Session de portail client créée avec succès.');
      return portalSession;
    } catch (error) {
      logger.error({ err: error, customerId }, 'Erreur lors de la création de la session de portail client.');
      throw new AppError('Impossible de créer la session de portail client.', 500, PaymentErrorCodes.PORTAL_SESSION_CREATION_FAILED);
    }
  }

  /**
   * Construit l'événement webhook à partir du corps de la requête brute et de la signature.
   * @param {Buffer} rawBody - Le corps de la requête brut.
   * @param {string} signature - L'en-tête 'stripe-signature' de la requête.
   * @returns {Stripe.Event} L'objet événement Stripe.
   */
  constructWebhookEvent(rawBody, signature) {
    this._ensureStripeActive();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new AppError('Stripe webhook secret is not configured.', 500, PaymentErrorCodes.STRIPE_ERROR);
    }

    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      logger.error('Erreur de vérification de la signature du webhook Stripe:', err);
      throw new AppError(`Webhook signature verification failed: ${err.message}`, 400, PaymentErrorCodes.STRIPE_SIGNATURE_INVALID);
    }
  }

  /**
   * Gère les événements webhook de Stripe.
   * @param {Stripe.Event} event - L'événement webhook à traiter.
   */
  async handleWebhook(event) {
    logger.info({ type: event.type, id: event.id }, 'Traitement d\'un événement webhook Stripe.');

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionChange(event.data.object);
        break;
        
      default:
        logger.warn({ type: event.type }, 'Événement webhook non géré.');
    }
  }

  /**
   * Gère la complétion d'une session de checkout.
   * @param {Stripe.Checkout.Session} session - La session de checkout.
   */
  async handleCheckoutSessionCompleted(session) {
    // Cette fonction est importante si des actions doivent être prises juste après le checkout
    // mais avant la première facture. Souvent, la logique est dans 'invoice.payment_succeeded'.
    logger.info({ sessionId: session.id, customerId: session.customer }, 'Session de checkout complétée.');
    // On pourrait par exemple provisionner un accès initial ici.
  }

  /**
   * Gère le succès du paiement d'une facture.
   * @param {Stripe.Invoice} invoice - La facture.
   */
  async handleInvoicePaymentSucceeded(invoice) {
    logger.info({ invoiceId: invoice.id, customerId: invoice.customer }, 'Paiement de facture réussi.');
    incrementStripePayments('invoice', 'success', invoice.currency);
    
    // Envoyer la facture par email
    const customer = await this.stripe.customers.retrieve(invoice.customer);
    if(customer.deleted) return;

    this.notificationService.sendInvoiceEmail(customer.email, {
      name: customer.name,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      invoice_pdf: invoice.invoice_pdf,
      lines: invoice.lines.data,
    });
  }

  /**
   * Gère l'échec du paiement d'une facture.
   * @param {Stripe.Invoice} invoice - La facture.
   */
  async handleInvoicePaymentFailed(invoice) {
    logger.warn({ invoiceId: invoice.id, customerId: invoice.customer }, 'Paiement de facture échoué.');
    incrementStripePayments('invoice', 'failure', invoice.currency);
    // On pourrait envoyer une notification à l'utilisateur pour qu'il mette à jour son moyen de paiement.
  }

  /**
   * Gère les changements d'état d'un abonnement.
   * @param {Stripe.Subscription} subscription - L'objet abonnement.
   */
  async handleSubscriptionChange(subscription) {
    const customerId = subscription.customer;
    const status = subscription.status; // ex: 'active', 'trialing', 'past_due', 'canceled'
    const planId = subscription.items.data[0]?.price.id;

    logger.info({ customerId, status, planId }, 'Mise à jour du statut de l\'abonnement.');
    
    try {
      await this.dbClient.updateUserByCustomerId(customerId, {
        subscriptionStatus: status,
        subscriptionPlanId: planId,
      });
      logger.info({ customerId }, 'Statut de l\'abonnement mis à jour dans la base de données.');
    } catch (err) {
      logger.error({ err, customerId }, 'Erreur lors de la mise à jour du statut de l\'abonnement.');
    }
  }

  /**
   * Récupère l'abonnement actif pour un client Stripe.
   * @param {string} customerId - L'ID du client Stripe.
   * @returns {Promise<Stripe.Subscription|null>} L'abonnement actif ou null.
   */
  async getActiveSubscription(customerId) {
    this._ensureStripeActive();
    logger.info({ customerId }, "Récupération de l'abonnement actif.");

    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
        expand: ['data.plan.product'], // Pour inclure les détails du produit
      });

      if (subscriptions.data.length > 0) {
        logger.info({ customerId, subscriptionId: subscriptions.data[0].id }, 'Abonnement actif trouvé.');
        return subscriptions.data[0];
      }

      logger.info({ customerId }, 'Aucun abonnement actif trouvé.');
      return null;
    } catch (error) {
      logger.error({ err: error, customerId }, "Erreur lors de la récupération de l'abonnement.");

      // Amélioration de la gestion des erreurs Stripe
      if (error.type) {
        switch (error.type) {
          case 'StripeCardError': // Erreur de carte
            throw new AppError(`Un problème est survenu avec la carte: ${error.message}`, 402, PaymentErrorCodes.CARD_ERROR);
          case 'StripeInvalidRequestError': // Paramètres invalides
            throw new AppError(`Requête invalide auprès de Stripe: ${error.message}`, 400, PaymentErrorCodes.STRIPE_INVALID_REQUEST);
          case 'StripeAPIError': // Erreur générale de l'API Stripe
            throw new AppError(`L'API Stripe a retourné une erreur: ${error.message}`, 502, PaymentErrorCodes.STRIPE_API_ERROR);
          case 'StripeConnectionError': // Problème de connexion
            throw new AppError(`Impossible de se connecter aux services de Stripe: ${error.message}`, 504, PaymentErrorCodes.STRIPE_CONNECTION_ERROR);
          case 'StripeAuthenticationError': // Problème d'authentification (clé API)
            throw new AppError(`Erreur d'authentification avec Stripe. Veuillez vérifier votre clé API.`, 500, PaymentErrorCodes.STRIPE_AUTHENTICATION_ERROR);
          default:
            throw new AppError(`Une erreur inattendue est survenue avec Stripe: ${error.message}`, 500, PaymentErrorCodes.STRIPE_ERROR);
        }
      }

      // Erreur générique si ce n'est pas une erreur Stripe
      throw new AppError("Impossible de récupérer l'abonnement.", 500, PaymentErrorCodes.SUBSCRIPTION_FAILED);
    }
  }
}

module.exports = StripeService;