import { listUsers } from '../repositories/userRepository.js';

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

const parseOptionalBoolean = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  return undefined;
};

export const getUsers = async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const isActive = parseOptionalBoolean(req.query.isActive);

    const result = await listUsers({
      page,
      limit,
      isActive,
    });

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while fetching users',
    });
  }
};

