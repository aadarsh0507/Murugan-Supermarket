import express from 'express';
import { protect, requireScreen } from '../middleware/auth.js';
import {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  receivePurchaseOrder,
  getPurchaseOrderBarcodes,
  regeneratePurchaseOrderBarcodes,
} from '../controllers/purchaseOrderController.js';

const router = express.Router();

router.use(protect);
router.use(requireScreen('purchase-orders'));

router.get('/', getPurchaseOrders);
router.post('/', createPurchaseOrder);
router.get('/:id', getPurchaseOrderById);
router.put('/:id', updatePurchaseOrder);
router.delete('/:id', deletePurchaseOrder);
router.patch('/:id/receive', receivePurchaseOrder);
router.get('/:id/barcodes', getPurchaseOrderBarcodes);
router.post('/:id/regenerate-barcodes', regeneratePurchaseOrderBarcodes);

export default router;

