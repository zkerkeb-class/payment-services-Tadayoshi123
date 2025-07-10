const axios = require('axios');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

class DbServiceClient {
  constructor() {
    this.baseURL = process.env.DB_SERVICE_URL;
    if (!this.baseURL) {
      logger.warn('DB_SERVICE_URL is not set. DB client will be disabled.');
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
      logger.info(`DB service client initialized for URL: ${this.baseURL}`);
    }
  }

  _generateServiceToken() {
    const payload = {
      serviceId: 'payment-service',
      permissions: ['users:read', 'users:update'],
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1m' });
  }

  async getUserById(userId) {
    if (!this.client) throw new Error('DB Client is not initialized.');
    try {
      const response = await this.client.get(`/api/v1/users/${userId}`);
      return response.data.data;
    } catch (error) {
      logger.error({ err: error, userId }, 'Error fetching user from DB service.');
      throw error;
    }
  }

  async updateUser(userId, data) {
    if (!this.client) throw new Error('DB Client is not initialized.');
    try {
      const response = await this.client.put(`/api/v1/users/${userId}`, data);
      return response.data.data;
    } catch (error) {
      logger.error({ err: error, userId }, 'Error updating user in DB service.');
      throw error;
    }
  }

  async updateUserByCustomerId(customerId, data) {
    if (!this.client) throw new Error('DB Client is not initialized.');
    try {
      // Cet endpoint doit exister dans le service de base de données.
      // ex: PUT /api/v1/internal/users/by-customer-id/:customerId
      const response = await this.client.put(`/api/v1/internal/users/by-customer-id/${customerId}`, data);
      return response.data.data;
    } catch (error) {
      logger.error({ err: error, customerId }, 'Error updating user by customer ID in DB service.');
      throw error;
    }
  }
}

module.exports = new DbServiceClient(); 