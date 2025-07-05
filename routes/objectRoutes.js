import express from 'express';
import {
  saveObject,
  getDropdownOptions,
  getRecentObjectsByUser,
  deleteObjectById
} from '../controllers/objectController.js';

import {
  verifyApiKey,
  authenticateToken
} from '../middlewares/authMiddleware.js'; // Ensure the path is correct

const router = express.Router();

router.post('/objects', verifyApiKey, authenticateToken, saveObject);
router.get('/dropdown-options', verifyApiKey, authenticateToken, getDropdownOptions);
router.get('/objects/user/:userid', verifyApiKey, authenticateToken, getRecentObjectsByUser);
router.delete('/objects/:id', verifyApiKey, authenticateToken, deleteObjectById);

export default router;