import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand
} from '../controllers/brandController.js';

const router = express.Router();

router.use(protect);

// Brand routes
router.get('/', getAllBrands);
router.get('/:id', getBrandById);
router.post('/', createBrand);
router.put('/:id', updateBrand);
router.delete('/:id', deleteBrand);

export default router;

