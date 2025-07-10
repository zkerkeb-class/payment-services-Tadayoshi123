const request = require('supertest');
const express = require('express');
const PaymentController = require('../src/controllers/payment.controller');
const paymentRoutes = require('../src/routes/payment.routes');
const dbClient = require('../src/services/db-client');
const { errorHandler } = require('../src/middlewares/errorHandler');

// Mock des dépendances qui ne sont pas l'objet du test
jest.mock('../src/services/db-client');
jest.mock('../src/middlewares/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 'user-123', sub: 'user-123' }; // Mock d'un utilisateur authentifié
    next();
  },
}));

describe('Payment Controller', () => {
  let app;
  let mockStripeService;

  beforeEach(() => {
    // Créer un mock du service Stripe avec des fonctions jest pour chaque méthode
    mockStripeService = {
      createCustomer: jest.fn(),
      createCheckoutSession: jest.fn(),
      createPortalSession: jest.fn(),
      getActiveSubscription: jest.fn(),
    };

    // Créer une instance du contrôleur avec le service mocké
    const paymentController = new PaymentController(mockStripeService);
    
    // Créer une app express minimale pour ce test
    app = express();
    app.use(express.json());
    app.use('/api/v1', paymentRoutes(paymentController));
    app.use(errorHandler); // Important pour attraper les erreurs d'AppError
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/checkout-sessions', () => {
    it('devrait créer une session de checkout et retourner une URL', async () => {
      const mockUser = { id: 'user-123', email: 'test@supervia.com', stripeCustomerId: null };
      const mockCustomer = { id: 'cus_123' };
      const mockSession = { id: 'cs_123', url: 'https://checkout.stripe.com/session123' };

      dbClient.getUserById.mockResolvedValue(mockUser);
      mockStripeService.createCustomer.mockResolvedValue(mockCustomer);
      mockStripeService.createCheckoutSession.mockResolvedValue(mockSession);

      const response = await request(app)
        .post('/api/v1/checkout-sessions')
        .send({
          priceId: 'price_123',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel',
        })
        .expect(200);

      expect(response.body).toEqual({ sessionId: mockSession.id, url: mockSession.url });
      expect(dbClient.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockStripeService.createCustomer).toHaveBeenCalledWith('user-123', mockUser);
      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        mockCustomer.id,
        'price_123',
        'http://localhost:3000/success',
        'http://localhost:3000/cancel'
      );
    });
  });

  describe('POST /api/v1/portal-sessions', () => {
    it('devrait créer une session de portail client et retourner une URL', async () => {
      const mockUser = { id: 'user-123', stripeCustomerId: 'cus_123' };
      const mockPortalSession = { url: 'https://billing.stripe.com/portal123' };

      dbClient.getUserById.mockResolvedValue(mockUser);
      mockStripeService.createPortalSession.mockResolvedValue(mockPortalSession);

      const response = await request(app)
        .post('/api/v1/portal-sessions')
        .send({ returnUrl: 'http://localhost:3000/dashboard' })
        .expect(200);

      expect(response.body).toEqual({ url: mockPortalSession.url });
      expect(dbClient.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockStripeService.createPortalSession).toHaveBeenCalledWith(
        'cus_123',
        'http://localhost:3000/dashboard'
      );
    });

    it("devrait retourner une erreur 404 si l'utilisateur n'a pas de client Stripe", async () => {
      dbClient.getUserById.mockResolvedValue({ id: 'user-123', stripeCustomerId: null });

      await request(app)
        .post('/api/v1/portal-sessions')
        .send({ returnUrl: 'http://localhost:3000/dashboard' })
        .expect(404);
    });
  });

  describe('GET /api/v1/subscription', () => {
    it("devrait retourner l'abonnement actif de l'utilisateur", async () => {
      const mockUser = { id: 'user-123', stripeCustomerId: 'cus_123' };
      const mockSubscription = { id: 'sub_123', status: 'active', plan: { name: 'Pro Plan' } };

      dbClient.getUserById.mockResolvedValue(mockUser);
      mockStripeService.getActiveSubscription.mockResolvedValue(mockSubscription);

      const response = await request(app)
        .get('/api/v1/subscription')
        .expect(200);

      expect(response.body).toEqual({ subscription: mockSubscription });
      expect(dbClient.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockStripeService.getActiveSubscription).toHaveBeenCalledWith('cus_123');
    });

    it("devrait retourner null si l'utilisateur n'a pas d'abonnement actif", async () => {
        const mockUser = { id: 'user-123', stripeCustomerId: 'cus_123' };
  
        dbClient.getUserById.mockResolvedValue(mockUser);
        mockStripeService.getActiveSubscription.mockResolvedValue(null);
  
        const response = await request(app)
          .get('/api/v1/subscription')
          .expect(200);
  
        expect(response.body).toEqual({ subscription: null });
    });

    it("devrait retourner null si l'utilisateur n'a pas de stripeCustomerId", async () => {
        const mockUser = { id: 'user-123', stripeCustomerId: null };
  
        dbClient.getUserById.mockResolvedValue(mockUser);
  
        const response = await request(app)
            .get('/api/v1/subscription')
            .expect(200);

        expect(response.body).toEqual({ subscription: null });
        expect(mockStripeService.getActiveSubscription).not.toHaveBeenCalled();
    });

    it("devrait retourner une erreur 404 si l'utilisateur n'est pas trouvé", async () => {
        dbClient.getUserById.mockResolvedValue(null);

        await request(app)
            .get('/api/v1/subscription')
            .expect(404);
    });
  });
}); 