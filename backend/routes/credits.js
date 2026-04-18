import express from 'express';
import { protect, requireScreen, requireAnyScreen } from '../middleware/auth.js';
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

router.get('/', requireAnyScreen(['credits', 'reports']), getAllCredits);
router.get('/summary/:supplierId', requireAnyScreen(['credits', 'reports']), getCreditsSummaryBySupplier);
router.get('/:id', requireAnyScreen(['credits', 'reports']), getCreditById);

router.post('/', requireScreen('credits'), createCredit);
router.put('/:id/amount', requireScreen('credits'), updateCreditAmount);
router.put('/:id/payment', requireScreen('credits'), updateCreditPayment);
router.delete('/:id', requireScreen('credits'), deleteCredit);

export default router;

