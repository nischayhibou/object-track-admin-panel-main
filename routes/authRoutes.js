import express from 'express';
import { verifyApiKey, authenticateToken } from '../middlewares/authMiddleware.js';
import * as authController from '../controllers/authController.js';

const router = express.Router();

router.post('/register', verifyApiKey, authController.register);
router.post('/login', verifyApiKey, authController.login);
router.post('/logout', verifyApiKey, authenticateToken, authController.logout);
router.get('/user', verifyApiKey, authenticateToken, authController.getUserInfo);

export default router;