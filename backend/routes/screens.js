import express from 'express';
import { protect, requireScreen } from '../middleware/auth.js';
import { getScreens } from '../controllers/screenController.js';

const router = express.Router();

router.get('/', protect, requireScreen('user-rights'), getScreens);

export default router;

