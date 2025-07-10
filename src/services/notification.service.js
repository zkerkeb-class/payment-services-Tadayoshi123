const axios = require('axios');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

class NotificationService {
  constructor() {
    this.baseURL = process.env.NOTIFICATION_SERVICE_URL;
    if (!this.baseURL) {
      logger.warn('NOTIFICATION_SERVICE_URL is not set. Notification service will be disabled.');
      this.client = null;
    } else {
      this.client = axios.create({
        baseURL: this.baseURL,
        timeout: 10000,
      });
      this.client.interceptors.request.use(
        (config) => {
          const token = this._generateServiceToken();
          config.headers.Authorization = `Bearer ${token}`;
          return config;
        },
        (error) => Promise.reject(error)
      );
      logger.info(`Notification service client initialized for URL: ${this.baseURL}`);
    }
  }

  _generateServiceToken() {
    const payload = {
      serviceId: 'payment-service',
      permissions: ['send_email'],
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1m' });
  }

  async sendInvoiceEmail(email, invoiceData) {
    if (!this.client) {
      logger.warn({ email }, 'Skipping invoice email because notification service is disabled.');
      return;
    }

    try {
      await this.client.post('/api/v1/send-email', {
        to: email,
        subject: 'Votre facture SupervIA',
        template: 'invoice', // Ce template doit être créé dans le service de notification
        context: {
          name: invoiceData.name,
          amount: (invoiceData.amount / 100).toFixed(2), // Convertir en euros/dollars
          currency: invoiceData.currency,
          lines: invoiceData.lines,
          // On ne peut pas envoyer le PDF directement, mais on peut envoyer un lien
          invoice_url: invoiceData.invoice_pdf, 
        },
      });
      logger.info({ email }, 'Demande d\'envoi d\'email de facture envoyée.');
    } catch (error) {
      logger.error({ err: error, email }, 'Error sending invoice email via notification service.');
    }
  }
}

module.exports = new NotificationService(); 