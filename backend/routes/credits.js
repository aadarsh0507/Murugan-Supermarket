import express from 'express';
import { protect, requireScreen } from '../middleware/auth.js';
import {
  getAllCredits,
  getCreditById,
  createCredit,
  updateCreditAmount,
  updateCreditPayment,
  deleteCredit,
  getCreditsSummaryBySupplier,
} from '../controllers/creditController.js';

const router = express.Router();

router.use(protect);
router.use(requireScreen('credits'));

router.get('/', getAllCredits);
router.get('/summary/:supplierId', getCreditsSummaryBySupplier);
router.get('/:id', getCreditById);

router.post('/', createCredit);
router.put('/:id/amount', updateCreditAmount);
router.put('/:id/payment', updateCreditPayment);
router.delete('/:id', deleteCredit);

export default router;

