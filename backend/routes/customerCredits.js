import express from 'express';
import { protect, requireScreen, requireAnyScreen } from '../middleware/auth.js';
import {
  getCustomerCredits,
  getCustomerCreditById,
  createCustomerCredit,
  updateCustomerCreditAmount,
  updateCustomerCreditPayment,
  deleteCustomerCredit,
  getCustomerByPhone,
  updateCustomerCreditDetail,
  toggleCustomerCreditVisibility,
} from '../controllers/customerCreditController.js';

const router = express.Router();

router.use(protect);

// Listing / read: Reports page needs billing credit data without granting full Credits screen
router.get('/', requireAnyScreen(['credits', 'reports']), getCustomerCredits);
router.get('/customer-by-phone/:phone', requireAnyScreen(['credits', 'reports']), getCustomerByPhone);
router.get('/:id', requireAnyScreen(['credits', 'reports']), getCustomerCreditById);

router.post('/', requireScreen('credits'), createCustomerCredit);
router.put('/:id/amount', requireScreen('credits'), updateCustomerCreditAmount);
router.put('/:id/payment', requireScreen('credits'), updateCustomerCreditPayment);
router.put('/:id/detail', requireScreen('credits'), updateCustomerCreditDetail);
router.put('/:id/hide', requireScreen('credits'), toggleCustomerCreditVisibility);
router.delete('/:id', requireScreen('credits'), deleteCustomerCredit);

export default router;

