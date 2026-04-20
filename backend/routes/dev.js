import express from 'express';
import multer from 'multer';
import { requireDevApiKey } from '../middleware/devApiKey.js';
import { createPurchaseOrder } from '../controllers/purchaseOrderController.js';
import {
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  getItemByBarcode,
} from '../controllers/itemController.js';
import { importProductsCsv } from '../controllers/devProductsController.js';

const router = express.Router();

// Dev-only endpoints intended for Postman / quick integrations.
// Guarded by DEV_API_KEY (x-api-key header).
router.use(requireDevApiKey);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

router.post('/purchase-orders', createPurchaseOrder);

// Products live in `Products` table in your DB, but are exposed via the items controller.
// These endpoints are dev-only and bypass JWT/screens.
router.get('/products', getAllItems);
router.get('/products/barcode/:barcode', getItemByBarcode);
router.get('/products/:id', getItemById);
router.post('/products', createItem);
router.post('/products/import-csv', csvUpload.single('file'), importProductsCsv);
router.put('/products/:id', updateItem);
router.delete('/products/:id', deleteItem);

export default router;

