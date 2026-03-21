import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getAllItems,
  getItemById,
  getItemsCount,
  createItem,
  updateItem,
  deleteItem,
  toggleItemStatus,
  getItemByBarcode,
  uploadItemImage,
  getStockWithBatches
} from '../controllers/itemController.js';
import { protect, requireScreen } from '../middleware/auth.js';
import { ensureDirectoryExists, itemUploadsDir } from '../utils/uploads.js';

const router = express.Router();

const itemImageStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    ensureDirectoryExists(itemUploadsDir);
    cb(null, itemUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname || '');
    cb(null, `item-${uniqueSuffix}${extension}`);
  }
});

const itemImageUpload = multer({
  storage: itemImageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const handleItemImageUpload = (req, res, next) => {
  itemImageUpload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Image upload failed'
      });
    }
    next();
  });
};

router.use(protect);

// Read operations - accessible to all authenticated users
router.get('/', getAllItems);
router.get('/count', getItemsCount);
router.get('/stock-with-batches', getStockWithBatches);
router.get('/barcode/:barcode', getItemByBarcode);
router.get('/:id', getItemById);

// Write operations - require 'items' screen permission
router.use(requireScreen('items'));
router.post('/:id/image', handleItemImageUpload, uploadItemImage);
router.post('/', createItem);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);
router.patch('/:id/toggle-status', toggleItemStatus);

export default router;

