import express from 'express';
import { backupAndUpload, startSyncToGlobal, streamSyncToGlobal } from '../controllers/syncController.js';

const router = express.Router();

// Sync tables from client DB to global SQL (run when user clicks Backup)
router.post('/', startSyncToGlobal);
router.get('/stream', streamSyncToGlobal);

router.post('/backup-and-upload', backupAndUpload);

export default router;
