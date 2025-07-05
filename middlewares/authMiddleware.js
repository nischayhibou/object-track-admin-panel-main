// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import fs from 'fs';
const config = JSON.parse(fs.readFileSync(new URL('../config/config.json', import.meta.url)));

const { apiKey, jwtSecret, cookieName } = config.server;

/**
 * Middleware to verify API key from headers
 */
export const verifyApiKey = (req, res, next) => {
  const clientKey = req.headers['x-api-key'];

  if (!clientKey || clientKey !== apiKey) {
    return res.status(403).json({ error: 'Forbidden - Invalid API Key' });
  }

  next();
};

/**
 * Middleware to authenticate JWT token from cookies
 */
export const authenticateToken = (req, res, next) => {
  const token = req.cookies[cookieName];
  if (!token) {
    return res.status(403).json({ error: 'Unauthorized - No token provided' });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token expired or invalid' });
    }

    req.user = user;
    next();
  });
};