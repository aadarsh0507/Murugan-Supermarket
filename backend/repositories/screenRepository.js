import { query } from '../db/index.js';
import { SCREEN_ID_TO_SCREEN, SCREEN_DEFINITIONS } from '../constants/screens.js';

const canonicalScreen = (id) => {
  if (id === undefined || id === null) return null;
  return SCREEN_ID_TO_SCREEN[id] || SCREEN_ID_TO_SCREEN[String(id)] || null;
};

const mapScreen = (row) => {
  const fallback = canonicalScreen(row.id);
  const screenName =
    row.screen_name ??
    row.screenName ??
    fallback?.screenName ??
    fallback?.label
  const rawIsActive = row.is_active ?? row.isActive ?? fallback?.isActive ?? true;
  return {
    id: Number(row.id),
    screenName,
    isActive: Boolean(rawIsActive),
  };
};

export const listScreens = async ({ includeInactive = true } = {}) => {
  const whereClause = includeInactive ? '' : 'WHERE is_active = 1';
  const rows = await query(
    `SELECT id, screen_name, is_active
     FROM screens
     ${whereClause}
     ORDER BY id ASC`
  );

  const mapped = rows.map(mapScreen);
  if (mapped.length === 0) {
    return SCREEN_DEFINITIONS.map((screen) => ({
      id: screen.id,
      screenName: screen.label ?? screen.screenName ?? screen.key,
      isActive: screen.isActive ?? true,
    }));
  }

  return mapped;
};

export const getScreensByIds = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await query(
    `SELECT id, screen_name, is_active
     FROM screens
     WHERE id IN (${placeholders})
     ORDER BY id ASC`,
    ids
  );
  return rows.map(mapScreen);
};

