import Screen from '../models/Screen.js';
import { query } from '../db/index.js';
import {
    SCREEN_DEFINITIONS,
    normalizeScreenIdList,
    serializeScreenIdList,
} from '../constants/screens.js';

export const syncScreenDefinitions = async () => {
    const operations = SCREEN_DEFINITIONS.map((screen) =>
        Screen.upsert({
            id: screen.id,
            screenName: screen.label,
            isActive: screen.isActive ?? true,
        })
    );

    await Promise.all(operations);
};

const ensureScreenColumns = async () => {
    const ensureColumn = async (columnName, definition) => {
        const columnRows = await query('SHOW COLUMNS FROM users LIKE ?', [columnName]);
        if (columnRows.length === 0) {
            await query(`ALTER TABLE users ADD COLUMN ${definition}`);
        }
    };

    await ensureColumn(
        'screen_id',
        'screen_id VARCHAR(255) NULL DEFAULT NULL AFTER preferences'
    );
    await ensureColumn(
        'is_admin',
        'is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER screen_id'
    );
};

const hasLegacyScreensColumn = async () => {
    const columnRows = await query('SHOW COLUMNS FROM users LIKE ?', ['screens']);
    return columnRows.length > 0;
};

export const migrateUserScreensToKeys = async () => {
    await ensureScreenColumns();
    const legacyColumnPresent = await hasLegacyScreensColumn();

    const selectSql = legacyColumnPresent
        ? `SELECT id, COALESCE(screen_id, screens) AS screen_ids
           FROM users
           WHERE COALESCE(screen_id, screens) IS NOT NULL AND COALESCE(screen_id, screens) <> ''`
        : `SELECT id, screen_id AS screen_ids
           FROM users
           WHERE screen_id IS NOT NULL AND screen_id <> ''`;

    const rows = await query(selectSql);

    if (!rows.length) {
        if (legacyColumnPresent) {
            await query('ALTER TABLE users DROP COLUMN screens');
        }
        return;
    }

    let updated = 0;

    for (const row of rows) {
        const normalized = normalizeScreenIdList(row.screen_ids, { treatNullAsEmpty: true });
        if (normalized === null || normalized === undefined) {
            continue;
        }

        const serialized = serializeScreenIdList(normalized);
        if (serialized === null || serialized === row.screen_ids) {
            continue;
        }

        await query('UPDATE users SET screen_id = ? WHERE id = ?', [serialized, row.id]);
        updated += 1;
    }

    if (legacyColumnPresent) {
        await query('ALTER TABLE users DROP COLUMN screens');
    }

    return updated;
};

export const initializeScreens = async () => {
    await syncScreenDefinitions();
    await migrateUserScreensToKeys();
};


