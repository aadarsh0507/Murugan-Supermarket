import jwt from 'jsonwebtoken';
import {
  getUserById
} from '../repositories/userRepository.js';
import {
  SCREEN_DEFINITIONS,
  normalizeScreenIdList
} from '../constants/screens.js';

const DEFAULT_STANDARD_EXPIRY = '24h';
const DEFAULT_REMEMBER_EXPIRY = '30d';
const ALL_SCREEN_IDS = SCREEN_DEFINITIONS.map((screen) => screen.id);

export const resolveJwtExpiresIn = ({ rememberMe = false, expiresIn } = {}) => {
  if (expiresIn) {
    return expiresIn;
  }
  const envValue = process.env.JWT_EXPIRE?.trim();
  if (envValue) {
    return envValue;
  }
  return rememberMe ? DEFAULT_REMEMBER_EXPIRY : DEFAULT_STANDARD_EXPIRY;
};

export const jwtExpiryToMs = (value) => {
  if (!value) {
    return 24 * 60 * 60 * 1000;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const match = String(value).trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    return 24 * 60 * 60 * 1000;
  }
  const quantity = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const unitMap = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  const multiplier = unitMap[unit];
  if (!multiplier) {
    return 24 * 60 * 60 * 1000;
  }
  return quantity * multiplier;
};

const parseCookieHeader = (cookieHeader = '') => {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [key, ...rest] = part.split('=');
      if (!key) return acc;
      acc[key] = decodeURIComponent(rest.join('='));
      return acc;
    }, {});
};

const getTokenFromRequest = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }

  if (req.cookies?.token) {
    return req.cookies.token;
  }

  if (req.headers.cookie) {
    const cookies = parseCookieHeader(req.headers.cookie);
    if (cookies.token) {
      return cookies.token;
    }
  }

  return null;
};

// Generate JWT token
export const generateToken = (userId, options = {}) => {
  const expiresIn = resolveJwtExpiresIn(options);
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Authentication middleware
export const authenticate = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = verifyToken(token);

    const user = await getUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Token is valid but user no longer exists.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'User account is deactivated.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid token.'
    });
  }
};

export const protect = authenticate;

const flattenScreenInputs = (input) => {
  if (input === undefined || input === null) {
    return [];
  }
  if (Array.isArray(input)) {
    return input.flatMap((value) => flattenScreenInputs(value));
  }
  return [input];
};

export const resolveUserScreenIds = (user) => {
  if (!user) {
    return [];
  }

  if (user.isAdmin || user.is_admin) {
    return ALL_SCREEN_IDS;
  }

  const sources = [
    user.screenIds,
    user.screenRights,
    user.screenKeys,
    user.screen_id,
    user.screens,
    Array.isArray(user.allowedScreens)
      ? user.allowedScreens.map((screen) => screen?.id ?? screen?.screenId ?? screen?.screen_id)
      : undefined,
  ];

  const flattened = sources
    .filter((value) => value !== undefined && value !== null)
    .flatMap((value) => {
      if (Array.isArray(value)) {
        return value;
      }
      if (typeof value === 'string') {
        return value
          .split(',')
          .map((chunk) => chunk.trim())
          .filter(Boolean);
      }
      return [value];
    });

  const normalized = normalizeScreenIdList(flattened, { treatNullAsEmpty: true });
  if (!Array.isArray(normalized)) {
    return [];
  }

  return normalized;
};

const normalizeRequiredScreens = (screens) => {
  const flattened = flattenScreenInputs(screens);
  const normalized = normalizeScreenIdList(flattened, { treatNullAsEmpty: true });
  if (normalized === undefined || normalized === null) {
    return [];
  }
  return normalized;
};

export const requireScreens = (screens, { match = 'any' } = {}) => {
  const requiredScreens = normalizeRequiredScreens(screens);
  if (requiredScreens.length === 0) {
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required.',
      });
    }

    if (req.user.isAdmin || req.user.is_admin) {
      return next();
    }

    const userScreenIds = resolveUserScreenIds(req.user);
    const userScreenSet = new Set(userScreenIds);
    const hasAccess =
      match === 'all'
        ? requiredScreens.every((id) => userScreenSet.has(id))
        : requiredScreens.some((id) => userScreenSet.has(id));

    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Missing required screen permissions.',
        requiredScreens,
      });
    }

    next();
  };
};

export const requireScreen = (screen) => requireScreens([screen]);

export const requireAnyScreen = (screens) => requireScreens(screens, { match: 'any' });

export const requireAllScreens = (screens) => requireScreens(screens, { match: 'all' });

export const optionalAuth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (token) {
      const decoded = verifyToken(token);
      const user = await getUserById(decoded.userId);

      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    next();
  }
};
