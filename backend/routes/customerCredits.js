import express from 'express';
import { protect, requireScreen } from '../middleware/auth.js';
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
router.use(requireScreen('credits'));

router.get('/', getCustomerCredits);
router.get('/customer-by-phone/:phone', getCustomerByPhone);
router.get('/:id', getCustomerCreditById);

router.post('/', createCustomerCredit);
router.put('/:id/amount', updateCustomerCreditAmount);
router.put('/:id/payment', updateCustomerCreditPayment);
router.put('/:id/detail', updateCustomerCreditDetail);
router.put('/:id/hide', toggleCustomerCreditVisibility);
router.delete('/:id', deleteCustomerCredit);

export default router;

