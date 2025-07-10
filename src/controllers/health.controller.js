/**
 * Health check controller
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const getHealth = (req, res) => {
  res.status(200).json({
    status: 'UP',
    message: 'Payment service is running',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  getHealth,
}; 