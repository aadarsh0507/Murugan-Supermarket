import { query, hasUsersStoreIdColumn, hasUsersEditRightsColumn } from '../db/index.js';
import { getScreensByIds } from './screenRepository.js';
import { getStoreById as getStoreByIdFromRepository } from './storeRepository.js';
import {
    normalizeScreenIdList,
    serializeScreenIdList,
    mapScreenIdsToKeys,
    SCREEN_ID_TO_SCREEN,
    SCREEN_ID_TO_KEY,
} from '../constants/screens.js';

const sanitizeBoolean = (value) => value === 1 || value === true;

const resolveScreenColumnValue = (row) => {
    if (!row) return undefined;
    if (row.screen_id !== undefined && row.screen_id !== null) {
        return row.screen_id;
    }
    if (row.screenIds !== undefined && row.screenIds !== null) {
        return row.screenIds;
    }
    if (row.screen_ids !== undefined && row.screen_ids !== null) {
        return row.screen_ids;
    }
    return undefined;
};

const parseScreenList = (value) => {
    const normalized = normalizeScreenIdList(value);
    if (normalized === null) {
        return undefined;
    }
    return normalized;
};

const serializeScreenList = (value) => serializeScreenIdList(value);

const buildUserSelectColumns = () => {
    const columns = [
        'id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'address_street',
        'address_city',
        'address_state',
        'address_zip_code',
        'address_country',
        'preferences',
        'screen_id'
    ];
    if (hasUsersEditRightsColumn) {
        columns.push('edit_rights');
    }
    if (hasUsersStoreIdColumn) {
        columns.push('store_id');
    }
    columns.push(
        'is_admin',
        'is_active',
        'last_login_at',
        'reset_password_otp',
        'reset_password_otp_expires_at',
        'selected_store_id',
        'created_at',
        'updated_at'
    );
    return columns.join(', ');
};

const USER_SELECT_COLUMNS = buildUserSelectColumns();

const buildScreenLookupMap = (screens = []) => {
    const map = new Map();
    for (const screen of screens) {
        if (!screen) continue;
        const id = Number(screen.id);
        if (Number.isNaN(id)) continue;
        map.set(id, {
            id,
            screenName: screen.screen_name ?? screen.screenName ?? null,
            isActive: screen.is_active ?? screen.isActive ?? null
        });
    }
    return map;
};

const fetchScreenLookup = async (screenIds) => {
    if (!Array.isArray(screenIds) || screenIds.length === 0) {
        return new Map();
    }
    const uniqueIds = Array.from(
        new Set(
            screenIds
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id))
        )
    );
    if (uniqueIds.length === 0) {
        return new Map();
    }
    const screens = await getScreensByIds(uniqueIds);
    return buildScreenLookupMap(screens);
};

const mapScreenDetails = (screenIds, screenLookup) => {
    if (!Array.isArray(screenIds) || screenIds.length === 0 || !screenLookup) {
        return undefined;
    }
    const details = screenIds
        .map((id) => screenLookup.get(Number(id)))
        .map((screen, index) => {
            const screenId = Number(screenIds[index]);
            const fallback = SCREEN_ID_TO_SCREEN[screenId];
            const resolved = screen || fallback;
            if (!resolved) {
                return null;
            }
            const key = resolved.screenKey ?? fallback?.key ?? SCREEN_ID_TO_KEY[screenId] ?? null;
            const name =
                resolved.screenName ??
                resolved.screen_name ??
                resolved.label ??
                fallback?.label ??
                fallback?.screenName ??
                null;
            const isActiveRaw = resolved.isActive ?? resolved.is_active ?? fallback?.isActive;
            const isActive = isActiveRaw === null || isActiveRaw === undefined ? undefined : Boolean(isActiveRaw);
            return {
                id: screenId,
                key,
                name: name ?? key ?? `Screen ${screenId}`,
                isActive
            };
        })
        .filter(Boolean);
    return details.length > 0 ? details : undefined;
};

const mapUser = (row, stores = [], selectedStore = null, options = {}) => {
    if (!row) return null;
    const { screenIdsOverride, screenLookup, primaryStoreOverride = null } = options;
    const {
        id,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        address_street,
        address_city,
        address_state,
        address_zip_code,
        address_country,
        preferences,
        screen_id,
        edit_rights: edit_rights_raw,
        is_active,
        is_admin,
        last_login_at,
        reset_password_otp,
        reset_password_otp_expires_at,
        selected_store_id,
        store_id,
        created_at,
        updated_at
    } = row;
    const storeIdValue = hasUsersStoreIdColumn ? store_id : null;

    const screenIdsSource =
        screenIdsOverride !== undefined
            ? screenIdsOverride
            : parseScreenList(resolveScreenColumnValue({ screen_id }));
    const screenIds = screenIdsSource;
    const resolvedScreenIds = screenIds === undefined ? undefined : screenIds;
    const screenDetails = mapScreenDetails(resolvedScreenIds, screenLookup);
    const resolvedScreenKeys =
        screenDetails && screenDetails.length > 0
            ? screenDetails
                .map((screen) => screen.key)
                .filter((key) => typeof key === 'string')
            : resolvedScreenIds === undefined
                ? undefined
                : mapScreenIdsToKeys(resolvedScreenIds);
    const screenNames =
        screenDetails && screenDetails.length > 0
            ? screenDetails.map((screen) => screen.name).filter(Boolean)
            : undefined;

    const numericSelectedStoreId =
        selected_store_id != null && selected_store_id !== ''
            ? Number(selected_store_id)
            : null;

    return {
        _id: id,
        id,
        firstName,
        lastName,
        email,
        phone,
        address: {
            street: address_street,
            city: address_city,
            state: address_state,
            zipCode: address_zip_code,
            country: address_country
        },
        preferences: preferences ? JSON.parse(preferences) : undefined,
        editRights: hasUsersEditRightsColumn && edit_rights_raw ? (typeof edit_rights_raw === 'string' ? JSON.parse(edit_rights_raw) : edit_rights_raw) : undefined,
        isActive: sanitizeBoolean(is_active),
        lastLogin: last_login_at,
        resetPasswordOTP: reset_password_otp,
        resetPasswordOTPExpires: reset_password_otp_expires_at,
        selectedStoreId:
            numericSelectedStoreId != null && Number.isFinite(numericSelectedStoreId) && numericSelectedStoreId > 0
                ? numericSelectedStoreId
                : null,
        selectedStore: selectedStore || (selected_store_id
            ? stores.find(
                  (store) => Number(store._id ?? store.id) === Number(selected_store_id)
              ) || null
            : null),
        stores,
        storeId: storeIdValue ?? null,
        primaryStore:
            primaryStoreOverride ||
            (hasUsersStoreIdColumn &&
                storeIdValue &&
                Array.isArray(stores)
                ? stores.find((store) => Number(store._id ?? store.id) === Number(storeIdValue)) || null
                : null),
        isAdmin: sanitizeBoolean(is_admin ?? row.isAdmin),
        screenKeys: resolvedScreenKeys,
        screenIds: resolvedScreenIds,
        screenRights: resolvedScreenKeys,
        screenNames,
        allowedScreens: screenDetails,
        created_at,
        updated_at
    };
};

export const findUserByEmail = async (email, { includePassword = false } = {}) => {
    const selectColumns = includePassword ? `${USER_SELECT_COLUMNS}, password_hash` : USER_SELECT_COLUMNS;
    const rows = await query(`SELECT ${selectColumns} FROM users WHERE email = ? LIMIT 1`, [email]);
    if (rows.length === 0) return null;

    const userRow = rows[0];
    const stores = await getStoresForUser(userRow.id);
    const selectedStore = userRow.selected_store_id ? await getStoreById(userRow.selected_store_id) : null;
    let primaryStoreOverride = null;
    if (hasUsersStoreIdColumn && userRow.store_id) {
        const hasStore = stores.some((store) => Number(store._id ?? store.id) === Number(userRow.store_id));
        if (!hasStore) {
            primaryStoreOverride = await getStoreById(userRow.store_id);
        }
    }
    const screenIds = parseScreenList(resolveScreenColumnValue(userRow));
    const screenLookup = await fetchScreenLookup(screenIds || []);
    const mapped = mapUser(userRow, stores, selectedStore, {
        screenIdsOverride: screenIds,
        screenLookup,
        primaryStoreOverride
    });
    if (includePassword) {
        mapped.password_hash = userRow.password_hash;
    }
    return mapped;
};

export const createUser = async (userData) => {
    const {
        firstName,
        lastName,
        email,
        passwordHash,
        phone,
        address,
        preferences,
        isActive = true,
        createdBy,
        selectedStoreId,
        storeId,
        stores = [],
        screens = null,
        isAdmin = false
    } = userData;

    const serializedScreens = serializeScreenList(screens);

    const insertColumns = [
        'first_name',
        'last_name',
        'email',
        'password_hash',
        'phone',
        'address_street',
        'address_city',
        'address_state',
        'address_zip_code',
        'address_country',
        'preferences',
        'screen_id',
        'is_admin',
        'is_active',
        'created_by',
        'selected_store_id'
    ];
    const insertValues = [
        firstName,
        lastName || null,
        email,
        passwordHash,
        phone,
        address?.street || null,
        address?.city || null,
        address?.state || null,
        address?.zipCode || null,
        address?.country || 'India',
        preferences ? JSON.stringify(preferences) : null,
        serializedScreens,
        isAdmin ? 1 : 0,
        isActive ? 1 : 0,
        createdBy || null,
        selectedStoreId || null
    ];
    if (hasUsersStoreIdColumn) {
        insertColumns.push('store_id');
        insertValues.push(storeId || null);
    }
    insertColumns.push('created_at', 'updated_at');
    const placeholders = insertValues.map(() => '?');
    placeholders.push('NOW()', 'NOW()');
    const result = await query(
        `INSERT INTO users (${insertColumns.join(', ')})
      VALUES (${placeholders.join(', ')})`,
        insertValues
    );

    const userId = result.insertId;

    if (stores.length > 0) {
        await query(
            `INSERT INTO user_stores (user_id, store_id, created_at, updated_at) VALUES ${stores.map(() => '(?, ?, NOW(), NOW())').join(', ')}`,
            stores.flatMap((storeId) => [userId, storeId])
        );
    }

    return getUserById(userId);
};

export const getUserById = async (userId) => {
    const rows = await query(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (rows.length === 0) return null;

    const stores = await getStoresForUser(userId);
    const selectedStore = rows[0].selected_store_id ? await getStoreByIdFromRepository(rows[0].selected_store_id) : null;
    let primaryStoreOverride = null;
    if (hasUsersStoreIdColumn && rows[0].store_id) {
        const hasStore = stores.some((store) => Number(store._id ?? store.id) === Number(rows[0].store_id));
        if (!hasStore) {
            primaryStoreOverride = await getStoreByIdFromRepository(rows[0].store_id);
        }
    }
    const screenIds = parseScreenList(resolveScreenColumnValue(rows[0]));
    const screenLookup = await fetchScreenLookup(screenIds || []);
    return mapUser(rows[0], stores, selectedStore, {
        screenIdsOverride: screenIds,
        screenLookup,
        primaryStoreOverride
    });
};

export const getStoresForUser = async (userId) => {
    try {
        const rows = await query(
            `SELECT s.id AS _id, s.id, s.name, s.store_code AS code, s.address_city AS city
       FROM stores s
       INNER JOIN user_stores us ON us.store_id = s.id
       WHERE us.user_id = ?`,
            [userId]
        );
        return rows.map((row) => ({
            _id: row.id,
            id: row.id,
            name: row.name,
            code: row.code,
            city: row.city
        }));
    } catch (error) {
        // Some installs may not have user_stores yet; treat as "no assigned stores" instead of failing auth/profile.
        if (error?.code === 'ER_NO_SUCH_TABLE') {
            return [];
        }
        throw error;
    }
};

// Use the proper getStoreById from storeRepository to ensure all fields (including gstNumber) are included
export const getStoreById = getStoreByIdFromRepository;

export const updateUserLastLogin = async (userId) => {
    await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]);
    return getUserById(userId);
};

export const updateUserPassword = async (userId, passwordHash) => {
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
};

export const saveResetPasswordOTP = async (userId, otp, expiresAt) => {
    await query(
        'UPDATE users SET reset_password_otp = ?, reset_password_otp_expires_at = ? WHERE id = ?',
        [otp, expiresAt, userId]
    );
};

export const clearResetPasswordOTP = async (userId) => {
    await query(
        'UPDATE users SET reset_password_otp = NULL, reset_password_otp_expires_at = NULL WHERE id = ?',
        [userId]
    );
};

export const verifyResetPasswordOTP = async (userId, otp) => {
    const rows = await query(
        `SELECT reset_password_otp, reset_password_otp_expires_at
     FROM users WHERE id = ? LIMIT 1`,
        [userId]
    );

    if (rows.length === 0) return false;
    const { reset_password_otp, reset_password_otp_expires_at } = rows[0];
    if (!reset_password_otp || !reset_password_otp_expires_at) return false;
    if (reset_password_otp !== otp) return false;

    const expires = new Date(reset_password_otp_expires_at).getTime();
    return Date.now() <= expires;
};

export const listUsers = async ({
    page = 1,
    limit = 10,
    isActive
}) => {
    const offset = (page - 1) * limit;
    const filters = [];
    const params = [];

    if (isActive !== undefined) {
        filters.push('is_active = ?');
        params.push(isActive ? 1 : 0);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const users = await query(
        `SELECT ${USER_SELECT_COLUMNS}
     FROM users ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    const countRows = await query(
        `SELECT COUNT(*) AS total FROM users ${whereClause}`,
        params
    );

    const screenIdPairs = users.map((row) => ({
        row,
        screenIds: parseScreenList(resolveScreenColumnValue(row))
    }));

    const allScreenIds = screenIdPairs.flatMap(({ screenIds }) =>
        Array.isArray(screenIds) ? screenIds : []
    );
    const screenLookup = await fetchScreenLookup(allScreenIds);

    const mappedUsers = await Promise.all(
        screenIdPairs.map(async ({ row, screenIds }) => {
            const stores = await getStoresForUser(row.id);
            const selectedStore = row.selected_store_id ? await getStoreById(row.selected_store_id) : null;
            let primaryStoreOverride = null;
            if (hasUsersStoreIdColumn && row.store_id) {
                const hasStore = stores.some((store) => Number(store._id ?? store.id) === Number(row.store_id));
                if (!hasStore) {
                    primaryStoreOverride = await getStoreById(row.store_id);
                }
            }
            return mapUser(row, stores, selectedStore, {
                screenIdsOverride: screenIds,
                screenLookup,
                primaryStoreOverride
            });
        })
    );

    const total = countRows[0]?.total || 0;

    return {
        users: mappedUsers,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit) || 1,
            totalUsers: total,
            hasNext: page * limit < total,
            hasPrev: page > 1
        }
    };
};

export const updateUser = async (userId, updates) => {
    if (updates.email) {
        const duplicate = await query('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [updates.email, userId]);
        if (duplicate.length > 0) {
            const error = new Error('User with this email already exists');
            error.code = 'EMAIL_IN_USE';
            throw error;
        }
    }

    const fields = [];
    const params = [];

    if (updates.firstName !== undefined) {
        fields.push('first_name = ?');
        params.push(updates.firstName);
    }
    if (updates.lastName !== undefined) {
        fields.push('last_name = ?');
        params.push(updates.lastName || null);
    }
    if (updates.email !== undefined) {
        fields.push('email = ?');
        params.push(updates.email);
    }
    if (updates.phone !== undefined) {
        fields.push('phone = ?');
        params.push(updates.phone);
    }
    if (updates.address) {
        fields.push('address_street = ?', 'address_city = ?', 'address_state = ?', 'address_zip_code = ?', 'address_country = ?');
        params.push(
            updates.address.street || null,
            updates.address.city || null,
            updates.address.state || null,
            updates.address.zipCode || null,
            updates.address.country || 'India'
        );
    }
    if (updates.preferences !== undefined) {
        fields.push('preferences = ?');
        params.push(updates.preferences ? JSON.stringify(updates.preferences) : null);
    }
    if (updates.editRights !== undefined) {
        if (hasUsersEditRightsColumn) {
            fields.push('edit_rights = ?');
            // Save as JSON array, or null if empty array
            const editRightsValue = Array.isArray(updates.editRights) && updates.editRights.length > 0
                ? JSON.stringify(updates.editRights)
                : null;
            params.push(editRightsValue);
            console.log('💾 Saving editRights:', editRightsValue ? JSON.parse(editRightsValue) : null);
        } else {
            // Column doesn't exist yet, log warning but don't fail
            console.warn('⚠️ edit_rights column does not exist, skipping editRights update. Flag value:', hasUsersEditRightsColumn);
        }
    }
    if (updates.screens !== undefined) {
        const serializedScreens = serializeScreenList(updates.screens);
        fields.push('screen_id = ?');
        params.push(serializedScreens);
    }
    if (updates.isActive !== undefined) {
        fields.push('is_active = ?');
        params.push(updates.isActive ? 1 : 0);
    }
    if (updates.selectedStoreId !== undefined) {
        fields.push('selected_store_id = ?');
        params.push(updates.selectedStoreId || null);
    }
    if (hasUsersStoreIdColumn && updates.storeId !== undefined) {
        fields.push('store_id = ?');
        params.push(updates.storeId || null);
    }
    if (updates.isAdmin !== undefined) {
        fields.push('is_admin = ?');
        params.push(updates.isAdmin ? 1 : 0);
    }

    if (fields.length === 0) {
        return getUserById(userId);
    }

    params.push(userId);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);

    if (updates.stores) {
        await query('DELETE FROM user_stores WHERE user_id = ?', [userId]);
        if (updates.stores.length > 0) {
            await query(
                `INSERT INTO user_stores (user_id, store_id, created_at, updated_at) VALUES ${updates.stores.map(() => '(?, ?, NOW(), NOW())').join(', ')}`,
                updates.stores.flatMap((storeId) => [userId, storeId])
            );
        }
    }

    return getUserById(userId);
};

