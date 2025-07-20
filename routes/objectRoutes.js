import express from 'express';
import {
  saveObject,
  getDropdownOptions,
  getRecentObjectsByUser,
  deleteObjectById,
  getHistoryData,
  getObjectStatusHistory,
  getAllCameraIds,
  getAllStatuses
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
router.get('/history/user/:userid', verifyApiKey, authenticateToken, getHistoryData);
router.get('/status-history/:objectId', verifyApiKey, authenticateToken, getObjectStatusHistory);
router.get('/all-cameras/:userid', verifyApiKey, authenticateToken, getAllCameraIds);
router.get('/all-statuses', verifyApiKey, authenticateToken, getAllStatuses);

export default router;