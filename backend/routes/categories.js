import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getAllCategories,
  getCategoryById,
  getCategoryHierarchy,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory
} from '../controllers/categoryController.js';

const router = express.Router();

router.use(protect);

// Category routes
router.get('/', getAllCategories);
router.get('/hierarchy', getCategoryHierarchy);
router.get('/:id', getCategoryById);
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

// Subcategory routes
router.post('/subcategories', createSubcategory);
router.put('/subcategories/:id', updateSubcategory);
router.delete('/subcategories/:id', deleteSubcategory);

export default router;
