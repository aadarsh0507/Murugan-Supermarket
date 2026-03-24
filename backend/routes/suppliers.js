import express from 'express';
import { body, param } from 'express-validator';
import {
  listSuppliers,
  getSupplierByCode,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  toggleSupplierStatus,
  listStores as listSupplierStores,
  createStore as createSupplierStore,
  updateStore as updateSupplierStore,
  deleteStore as deleteSupplierStore,
  addStoreToSupplier,
  removeStoreFromSupplier
} from '../controllers/supplierController.js';
import { protect, requireScreen, requireAnyScreen } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

const supplierValidators = [
  body('Suppliername')
    .trim()
    .notEmpty()
    .withMessage('Suppliername is required')
];

const supplierCodeParam = [
  param('supplierCode').isInt({ min: 1 }).withMessage('Invalid supplier code')
];

// Read operations - accessible to all authenticated users
router.get('/', listSuppliers);
// Allow all authenticated users to access stores list (needed for store selection)
// IMPORTANT: This route must come before /:supplierCode to avoid matching "stores" as a supplier code
router.get(
  '/stores',
  listSupplierStores
);
router.get(
  '/:supplierCode',
  supplierCodeParam,
  getSupplierByCode
);

// Write operations - require 'suppliers' screen permission
router.use(requireScreen('suppliers'));

router.post(
  '/stores',
  createSupplierStore
);

router.put(
  '/stores/:storeId',
  updateSupplierStore
);

router.delete(
  '/stores/:storeId',
  deleteSupplierStore
);

// Add store to supplier
router.post(
  '/:supplierCode/stores',
  supplierCodeParam,
  addStoreToSupplier
);

// Remove store from supplier
router.delete(
  '/:supplierCode/stores/:storeId',
  supplierCodeParam,
  removeStoreFromSupplier
);

router.patch(
  '/:supplierCode/toggle-status',
  supplierCodeParam,
  toggleSupplierStatus
);

router.post(
  '/',
  supplierValidators,
  createSupplier
);

router.put(
  '/:supplierCode',
  supplierCodeParam,
  updateSupplier
);

router.delete(
  '/:supplierCode',
  supplierCodeParam,
  deleteSupplier
);

export default router;