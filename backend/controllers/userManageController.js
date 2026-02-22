import bcrypt from 'bcryptjs';
import {
  getUserById,
  getStoreById,
  createUser as createUserRepository,
  updateUser as updateUserRepository,
  findUserByEmail
} from '../repositories/userRepository.js';
import { normalizeScreenIdList } from '../constants/screens.js';

const parsedSaltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS, 10);
const BCRYPT_SALT_ROUNDS = Number.isFinite(parsedSaltRounds) && parsedSaltRounds > 0 ? parsedSaltRounds : 10;

const parseUserId = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeRequiredString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOptionalString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeScreenIdPayload = (value) => {
  if (value === undefined) return undefined;
  const normalized = normalizeScreenIdList(value, { treatNullAsEmpty: true });
  return normalized;
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

const parseStoreId = async (rawStoreId) => {
  if (rawStoreId === undefined || rawStoreId === null || rawStoreId === '' || rawStoreId === '__none__') {
    return null;
  }
  const parsed = Number.parseInt(rawStoreId, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('INVALID_STORE_ID');
  }
  const store = await getStoreById(parsed);
  if (!store) {
    throw new Error('STORE_NOT_FOUND');
  }
  return parsed;
};

const normalizeStoreList = async (rawStores) => {
  if (!Array.isArray(rawStores)) {
    return [];
  }
  const normalizedStores = [];
  for (const rawStoreId of rawStores) {
    const parsed = await parseStoreId(rawStoreId);
    if (parsed && !normalizedStores.includes(parsed)) {
      normalizedStores.push(parsed);
    }
  }
  return normalizedStores;
};

export const createUser = async (req, res) => {
  try {
    const firstName = normalizeRequiredString(req.body.firstName);
    if (!firstName) {
      return res.status(400).json({
        status: 'error',
        message: 'First name is required'
      });
    }

    const email = normalizeRequiredString(req.body.email)?.toLowerCase();
    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
    }

    const password = normalizeRequiredString(req.body.password);
    if (!password || password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long'
      });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }

    let primaryStoreId = null;
    try {
      primaryStoreId = await parseStoreId(req.body.storeId);
    } catch (error) {
      if (error.message === 'INVALID_STORE_ID') {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid store id'
        });
      }
      if (error.message === 'STORE_NOT_FOUND') {
        return res.status(400).json({
          status: 'error',
          message: 'Store not found'
        });
      }
      throw error;
    }

    let stores = [];
    try {
      stores = await normalizeStoreList(req.body.stores);
    } catch (error) {
      if (error.message === 'INVALID_STORE_ID') {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid store id in stores list'
        });
      }
      if (error.message === 'STORE_NOT_FOUND') {
        return res.status(400).json({
          status: 'error',
          message: 'Store in stores list not found'
        });
      }
      throw error;
    }

    const screensPayload = req.body.screens ?? req.body.screenIds ?? req.body.screenRights;
    const normalizedScreens = screensPayload !== undefined ? normalizeScreenIdPayload(screensPayload) : undefined;
    if (normalizedScreens === null) {
      return res.status(400).json({
        status: 'error',
        message: 'screens must be an array of valid screen IDs or keys'
      });
    }

    const passwordHash = await hashPassword(password);

    const newUser = await createUserRepository({
      firstName,
      lastName: normalizeOptionalString(req.body.lastName),
      email,
      passwordHash,
      phone: normalizeOptionalString(req.body.phone),
      isActive: req.body.isActive === undefined ? true : Boolean(req.body.isActive),
      isAdmin: req.body.isAdmin === true,
      storeId: primaryStoreId,
      selectedStoreId: primaryStoreId,
      stores,
      screens: normalizedScreens,
      createdBy: req.user?._id ?? req.user?.id ?? null
    });

    res.status(201).json({
      status: 'success',
      data: newUser
    });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 'EMAIL_IN_USE') {
      return res.status(409).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Server error while creating user'
    });
  }
};

const normalizeBooleanFlag = (value) => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (value === null) {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return null;
};

export const updateUser = async (req, res) => {
  try {
    const userId = parseUserId(req.params.userId || req.params.id);

    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user id',
      });
    }

    const existingUser = await getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    const updates = {};

    if (req.body.firstName !== undefined) {
      const firstName = normalizeRequiredString(req.body.firstName);
      if (!firstName) {
        return res.status(400).json({
          status: 'error',
          message: 'First name cannot be empty',
        });
      }
      updates.firstName = firstName;
    }

    if (req.body.lastName !== undefined) {
      updates.lastName = normalizeOptionalString(req.body.lastName);
    }

    if (req.body.email !== undefined) {
      const email = normalizeRequiredString(req.body.email);
      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'Email cannot be empty',
        });
      }
      updates.email = email;
    }

    if (req.body.phone !== undefined) {
      updates.phone = normalizeOptionalString(req.body.phone);
    }

    if (req.body.isActive !== undefined) {
      updates.isActive =
        typeof req.body.isActive === 'boolean'
          ? req.body.isActive
          : String(req.body.isActive).trim().toLowerCase() === 'true';
    }

    if (Array.isArray(req.body.stores)) {
      const normalizedStores = [];
      for (const rawStoreId of req.body.stores) {
        const parsed = Number.parseInt(rawStoreId, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid store id in stores list',
          });
        }

        const store = await getStoreById(parsed);
        if (!store) {
          return res.status(400).json({
            status: 'error',
            message: `Store with id ${parsed} not found`,
          });
        }

        if (!normalizedStores.includes(parsed)) {
          normalizedStores.push(parsed);
        }
      }
      updates.stores = normalizedStores;
    }

    if (req.body.storeId !== undefined) {
      const storeIdRaw = req.body.storeId;
      if (storeIdRaw === null || storeIdRaw === '' || storeIdRaw === undefined) {
        updates.storeId = null;
      } else {
        const parsedStoreId = Number.parseInt(storeIdRaw, 10);
        if (!Number.isFinite(parsedStoreId) || parsedStoreId <= 0) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid store id',
          });
        }
        const store = await getStoreById(parsedStoreId);
        if (!store) {
          return res.status(400).json({
            status: 'error',
            message: `Store with id ${parsedStoreId} not found`,
          });
        }
        updates.storeId = parsedStoreId;
      }
    }

    const screensPayload =
      req.body.screens ?? req.body.screenIds ?? req.body.screenRights;
    if (screensPayload !== undefined) {
      const normalizedScreens = normalizeScreenIdPayload(screensPayload);
      if (normalizedScreens === null) {
        return res.status(400).json({
          status: 'error',
          message: 'screens must be an array of valid screen IDs or keys',
        });
      }
      updates.screens = normalizedScreens;
    }

    if (req.body.editRights !== undefined) {
      const editRightsPayload = req.body.editRights;
      if (editRightsPayload === null) {
        updates.editRights = null;
      } else if (Array.isArray(editRightsPayload)) {
        const normalizedEditRights = normalizeScreenIdPayload(editRightsPayload);
        if (normalizedEditRights === null) {
          return res.status(400).json({
            status: 'error',
            message: 'editRights must be an array of valid screen IDs or keys',
          });
        }
        updates.editRights = normalizedEditRights;
        console.log('📝 Edit rights normalized:', normalizedEditRights);
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'editRights must be an array or null',
        });
      }
    }

    if (req.body.isAdmin !== undefined) {
      const normalizedAdmin = normalizeBooleanFlag(req.body.isAdmin);
      if (normalizedAdmin === null) {
        return res.status(400).json({
          status: 'error',
          message: 'isAdmin must be a boolean value',
        });
      }
      updates.isAdmin = normalizedAdmin;
    }

    const updatedUser = await updateUserRepository(userId, updates);

    res.json({
      status: 'success',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    let status = 500;
    let message = 'Server error while updating user';

    if (error.code === 'EMAIL_IN_USE') {
      status = 409;
      message = 'A user with this email already exists';
    }
    res.status(status).json({
      status: 'error',
      message,
    });
  }
};

