import express from 'express';
import multer from 'multer';
import path from 'path';
import { protect } from '../middleware/auth.js';
import { ensureDirectoryExists, returnUploadsDir } from '../utils/uploads.js';
import {
  listMobileOrders,
  getMobileOrderById,
  updateMobileOrderStatus,
  updateMobileOrderMeta,
  getDeliverySettings,
  updateDeliverySettings,
  listOrderReturns,
  submitOrderReturn,
  serveOrderReturnImage,
  updateOrderReturnStatus,
} from '../controllers/mobileOrderController.js';

const router = express.Router();

const returnImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDirectoryExists(returnUploadsDir);
    cb(null, returnUploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.jpg';
    cb(null, `return-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const returnImageUpload = multer({
  storage: returnImageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const handleReturnUpload = (req, res, next) => {
  returnImageUpload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Image upload failed',
      });
    }
    next();
  });
};

router.get('/return-image', serveOrderReturnImage);

router.use(protect);

router.get('/', listMobileOrders);
router.get('/returns', listOrderReturns);
router.patch('/returns/:id/status', updateOrderReturnStatus);
router.get('/settings', getDeliverySettings);
router.patch('/:id/return', handleReturnUpload, submitOrderReturn);
router.get('/:id', getMobileOrderById);
router.patch('/:id/status', updateMobileOrderStatus);
router.patch('/:id/meta', updateMobileOrderMeta);
router.put('/settings', updateDeliverySettings);

export default router;

