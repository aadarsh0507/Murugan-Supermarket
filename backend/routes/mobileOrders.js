import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  listMobileOrders,
  getMobileOrderById,
  updateMobileOrderStatus,
  updateMobileOrderMeta,
  getDeliverySettings,
  updateDeliverySettings,
} from '../controllers/mobileOrderController.js';

const router = express.Router();

router.use(protect);

router.get('/', listMobileOrders);
router.get('/settings', getDeliverySettings);
router.get('/:id', getMobileOrderById);
router.patch('/:id/status', updateMobileOrderStatus);
router.patch('/:id/meta', updateMobileOrderMeta);
router.put('/settings', updateDeliverySettings);

export default router;

