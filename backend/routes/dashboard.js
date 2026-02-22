import express from 'express';
import { getDashboardStats, getTotalSuppliersCount, getStoreItemsCount } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics for selected store
// @access  Private
router.get('/stats', authenticate, getDashboardStats);
router.get('/suppliers/total', authenticate, getTotalSuppliersCount);
router.get('/items/total', authenticate, getStoreItemsCount);

export default router;

