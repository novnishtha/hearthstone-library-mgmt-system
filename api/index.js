const app = require('../src/app');
const connectDB = require('../src/config/db');

module.exports = async function handler(req, res) {
  try {
    await connectDB();
    return app(req, res);
  } catch (err) {
    console.error('Serverless handler error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server initialization failed',
    });
  }
};
