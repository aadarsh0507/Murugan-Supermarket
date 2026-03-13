import express from 'express';
import { protect, requireScreen } from '../middleware/auth.js';
import {
  createBill,
  deleteBill,
  getBills,
  getBill,
  getBillByNumber,
  getCustomerByPhone,
  createBillValidation,
  billIdParamValidation,
  billNumberParamValidation,
  customerPhoneParamValidation
} from '../controllers/billController.js';
import { createOrder, verifyPayment, getKey } from '../controllers/razorpayController.js';

const router = express.Router();

router.use(protect);
router.use(requireScreen('billing'));

// Razorpay (UPI) payment – create order, verify, and get public key
router.get('/razorpay/key', getKey);
router.post('/razorpay/create-order', createOrder);
router.post('/razorpay/verify', verifyPayment);

router.post(
  '/',
  createBillValidation,
  createBill
);

router.delete(
  '/:id',
  billIdParamValidation,
  deleteBill
);

router.get(
  '/',
  getBills
);

router.get(
  '/customer/by-phone/:phone',
  customerPhoneParamValidation,
  getCustomerByPhone
);

router.get(
  '/number/:billNo',
  billNumberParamValidation,
  getBillByNumber
);

router.get(
  '/:id',
  billIdParamValidation,
  getBill
);

export default router;
// Temporarily commented out to isolate login and register modules.
// Original implementation preserved below for future reactivation.

// // import express from 'express';
// // import { body } from 'express-validator';
// // import {
// //   createBill,
// //   getAllBills,
// //   getBillById,
// //   getDailySalesSummary,
// //   getLowStockItems,
// //   getNoMovementItems
// // } from '../controllers/billController.js';
// // import { authenticate } from '../middleware/auth.js';
//
// // const router = express.Router();
//
// // // Validation rules for creating a bill
// // const createBillValidation = [
// //   body('billNumber')
// //     .notEmpty()
// //     .withMessage('Bill number is required')
// //     .trim(),
// //   body('counterNumber')
// //     .isInt({ min: 1 })
// //     .withMessage('Counter number must be a positive integer'),
// //   body('items')
// //     .isArray({ min: 1 })
// //     .withMessage('At least one item is required'),
// //   body('items.*.itemSku')
// //     .notEmpty()
// //     .withMessage('Item SKU is required'),
// //   body('items.*.itemName')
// //     .notEmpty()
// //     .withMessage('Item name is required'),
// //   body('items.*.mrp')
// //     .isFloat({ min: 0 })
// //     .withMessage('MRP must be a positive number'),
// //   body('items.*.saleRate')
// //     .isFloat({ min: 0 })
// //     .withMessage('Sale rate must be a positive number'),
// //   body('items.*.quantity')
// //     .isInt({ min: 1 })
// //     .withMessage('Quantity must be a positive integer'),
// //   body('items.*.netAmount')
// //     .isFloat({ min: 0 })
// //     .withMessage('Net amount must be a positive number'),
// //   body('totalAmount')
// //     .isFloat({ min: 0 })
// //     .withMessage('Total amount must be a positive number'),
// //   body('subtotal')
// //     .isFloat({ min: 0 })
// //     .withMessage('Subtotal must be a positive number'),
// //   body('discountAmount')
// //     .optional()
// //     .isFloat({ min: 0 })
// //     .withMessage('Discount amount must be a positive number'),
// //   body('totalQuantity')
// //     .optional()
// //     .isInt({ min: 0 })
// //     .withMessage('Total quantity must be a non-negative integer'),
// //   body('amountPaid')
// //     .optional()
// //     .isFloat({ min: 0 })
// //     .withMessage('Amount paid must be a positive number'),
// //   body('gstBreakdown')
// //     .optional()
// //     .isArray()
// //     .withMessage('GST breakdown must be an array'),
// //   body('gstBreakdown.*.basic')
// //     .optional()
// //     .isFloat({ min: 0 })
// //     .withMessage('Basic amount must be a positive number'),
// //   body('gstBreakdown.*.cgstPercent')
// //     .optional()
// //     .isFloat({ min: 0 })
// //     .withMessage('CGST percentage must be a positive number'),
// //   body('gstBreakdown.*.cgstAmount')
// //     .optional()
// //     .isFloat({ min: 0 })
// //     .withMessage('CGST amount must be a positive number'),
// //   body('gstBreakdown.*.sgstPercent')
// //     .optional()
// //     .isFloat({ min: 0 })
// //     .withMessage('SGST percentage must be a positive number'),
// //   body('gstBreakdown.*.sgstAmount')
// //     .optional()
// //     .isFloat({ min: 0 })
// //     .withMessage('SGST amount must be a positive number')
// // ];
//
// // // Routes
// // router.post('/', authenticate, createBillValidation, createBill);
// // router.get('/', authenticate, getAllBills);
// // router.get('/summary/:date', authenticate, getDailySalesSummary);
// // router.get('/low-stock', authenticate, getLowStockItems);
// // router.get('/no-movement', authenticate, getNoMovementItems);
// // router.get('/:id', authenticate, getBillById);
//
// // export default router;
//
