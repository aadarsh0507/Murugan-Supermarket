import express from 'express';
import { body } from 'express-validator';
import { protect, requireAnyScreen } from '../middleware/auth.js';
import {
    getSelectedStore,
    setSelectedStore
} from '../controllers/userSelectedStoreController.js';
import { getUsers } from '../controllers/userListController.js';
import { createUser, updateUser } from '../controllers/userManageController.js';

const router = express.Router();

const selectedStoreValidation = [
    body('storeId')
        .optional({ nullable: true })
        .custom((value) => {
            if (value === null || value === '' || value === undefined) {
                return true;
            }
            const numeric = Number(value);
            if (Number.isInteger(numeric) && numeric > 0) {
                return true;
            }
            throw new Error('Store ID must be a positive integer');
        })
];

router.get('/selected-store', protect, getSelectedStore);
router.put('/selected-store', protect, selectedStoreValidation, setSelectedStore);
const requireUserManagementAccess = requireAnyScreen(['users', 'user-rights']);

router.get('/', protect, requireUserManagementAccess, getUsers);
router.post('/', protect, requireUserManagementAccess, createUser);
router.put('/:userId', protect, requireUserManagementAccess, updateUser);

export default router;
