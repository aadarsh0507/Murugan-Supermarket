import { query } from '../db/index.js';

let ensureGstColumnPromise;
let ensureBankColumnsPromise;

const ensureGstColumn = async () => {
    if (ensureGstColumnPromise) {
        return ensureGstColumnPromise;
    }

    ensureGstColumnPromise = (async () => {
        try {
            const columns = await query(
                `SELECT COLUMN_NAME 
                 FROM information_schema.COLUMNS 
                 WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'stores' 
                   AND COLUMN_NAME = 'gst_number'`
            );
            if (!Array.isArray(columns) || columns.length === 0) {
                console.log('[Stores] Adding gst_number column to stores table...');
                await query(
                    `ALTER TABLE stores 
                     ADD COLUMN gst_number VARCHAR(20) NULL AFTER email`
                );
                console.log('[Stores] Successfully added gst_number column');
            } else {
                console.log('[Stores] gst_number column already exists');
            }
        } catch (error) {
            console.error('[Stores] Failed to migrate stores table for gst_number:', error);
            ensureGstColumnPromise = undefined;
            throw error;
        }
    })().catch((error) => {
        ensureGstColumnPromise = undefined;
        throw error;
    });

    return ensureGstColumnPromise;
};

const ensureBankColumns = async () => {
    if (ensureBankColumnsPromise) {
        return ensureBankColumnsPromise;
    }

    ensureBankColumnsPromise = (async () => {
        try {
            const columns = await query(
                `SELECT COLUMN_NAME 
                 FROM information_schema.COLUMNS 
                 WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'stores' 
                   AND COLUMN_NAME IN ('bank_name', 'bank_account_number', 'bank_ifsc_code', 'bank_branch_name')`
            );
            const existingColumns = Array.isArray(columns) ? columns.map(c => c.COLUMN_NAME) : [];

            if (!existingColumns.includes('bank_name')) {
                console.log('[Stores] Adding bank_name column to stores table...');
                await query(
                    `ALTER TABLE stores 
                     ADD COLUMN bank_name VARCHAR(100) NULL AFTER gst_number`
                );
            }
            if (!existingColumns.includes('bank_account_number')) {
                console.log('[Stores] Adding bank_account_number column to stores table...');
                await query(
                    `ALTER TABLE stores 
                     ADD COLUMN bank_account_number VARCHAR(50) NULL AFTER bank_name`
                );
            }
            if (!existingColumns.includes('bank_ifsc_code')) {
                console.log('[Stores] Adding bank_ifsc_code column to stores table...');
                await query(
                    `ALTER TABLE stores 
                     ADD COLUMN bank_ifsc_code VARCHAR(20) NULL AFTER bank_account_number`
                );
            }
            if (!existingColumns.includes('bank_branch_name')) {
                console.log('[Stores] Adding bank_branch_name column to stores table...');
                await query(
                    `ALTER TABLE stores 
                     ADD COLUMN bank_branch_name VARCHAR(100) NULL AFTER bank_ifsc_code`
                );
            }
            console.log('[Stores] Bank columns migration completed');
        } catch (error) {
            console.error('[Stores] Failed to migrate stores table for bank columns:', error);
            ensureBankColumnsPromise = undefined;
            throw error;
        }
    })().catch((error) => {
        ensureBankColumnsPromise = undefined;
        throw error;
    });

    return ensureBankColumnsPromise;
};

// Export function to manually ensure column exists (useful for testing)
export const ensureStoresGstColumn = ensureGstColumn;
export const ensureStoresBankColumns = ensureBankColumns;

// Migration function to update store codes for specific stores
const updateStoreCodesMigration = async () => {
    try {
        // Define the store code mappings: store_id -> store_code
        const storeCodeMappings = [
            { id: 1, code: 'MS' },
            { id: 2, code: 'MSM' }
        ];

        for (const mapping of storeCodeMappings) {
            try {
                // Check current store code
                const currentRows = await query(
                    `SELECT store_code FROM stores WHERE id = ? LIMIT 1`,
                    [mapping.id]
                );

                if (Array.isArray(currentRows) && currentRows.length > 0) {
                    const currentCode = currentRows[0].store_code;

                    // Only update if the code is different
                    if (currentCode !== mapping.code) {
                        // Check if the new code already exists for another store
                        const existingRows = await query(
                            `SELECT id FROM stores WHERE store_code = ? AND id != ? LIMIT 1`,
                            [mapping.code, mapping.id]
                        );

                        if (Array.isArray(existingRows) && existingRows.length === 0) {
                            // Safe to update - no conflict
                            await query(
                                `UPDATE stores SET store_code = ?, updated_at = NOW() WHERE id = ?`,
                                [mapping.code, mapping.id]
                            );
                            console.log(`✅ [Store Migration] Updated store ID ${mapping.id} code from "${currentCode}" to "${mapping.code}"`);
                        } else {
                            console.warn(`⚠️ [Store Migration] Cannot update store ID ${mapping.id} to "${mapping.code}" - code already exists for another store`);
                        }
                    } else {
                        console.log(`ℹ️ [Store Migration] Store ID ${mapping.id} already has code "${mapping.code}"`);
                    }
                } else {
                    console.warn(`⚠️ [Store Migration] Store ID ${mapping.id} not found in database`);
                }
            } catch (error) {
                console.error(`❌ [Store Migration] Error updating store ID ${mapping.id}:`, error.message);
            }
        }
    } catch (error) {
        console.error('[Store Migration] Error running store code migration:', error.message);
    }
};

/** Run store code migration. Called from server.js after DB connections so startup log order is correct. */
export const runStoreCodeMigration = () => updateStoreCodesMigration();

const mapStore = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        code: row.store_code,
        phone: row.phone,
        email: row.email,
        gstNumber: row.gst_number ?? null,
        bankDetails: {
            bankName: row.bank_name ?? null,
            accountNumber: row.bank_account_number ?? null,
            ifscCode: row.bank_ifsc_code ?? null,
            branchName: row.bank_branch_name ?? null
        },
        address: {
            street: row.address_street,
            city: row.address_city,
            state: row.address_state,
            zipCode: row.address_zip_code,
            country: row.address_country
        },
        isActive: row.is_active === 1 || row.is_active === true,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
};

const getNextStoreCode = async () => {
    const [row] = await query(
        `SELECT MAX(
        CASE
          WHEN store_code REGEXP '^[0-9]+$' THEN CAST(store_code AS UNSIGNED)
          ELSE 0
        END
      ) AS maxCode
     FROM stores`
    );

    const nextCode = (Number(row?.maxCode) || 0) + 1;
    return String(nextCode);
};

export const listStores = async ({ search, isActive } = {}) => {
    await ensureGstColumn();
    await ensureBankColumns();
    const filters = [];
    const params = [];

    if (search) {
        filters.push('(name LIKE ? OR store_code LIKE ?)');
        const term = `%${search}%`;
        params.push(term, term);
    }

    if (isActive !== undefined) {
        filters.push('is_active = ?');
        params.push(isActive ? 1 : 0);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const rows = await query(
        `SELECT id, name, store_code, phone, email, gst_number, 
            bank_name, bank_account_number, bank_ifsc_code, bank_branch_name,
            address_street, address_city, address_state, address_zip_code, address_country, 
            is_active, created_at, updated_at
     FROM stores
     ${whereClause}
     ORDER BY name ASC`,
        params
    );

    return rows.map(mapStore);
};

export const getStoreById = async (storeId) => {
    await ensureGstColumn();
    await ensureBankColumns();
    const rows = await query(
        `SELECT id, name, store_code, phone, email, gst_number, 
            bank_name, bank_account_number, bank_ifsc_code, bank_branch_name,
            address_street, address_city, address_state, address_zip_code, address_country, 
            is_active, created_at, updated_at
     FROM stores
     WHERE id = ?
     LIMIT 1`,
        [storeId]
    );

    if (rows.length === 0) return null;
    return mapStore(rows[0]);
};

export const createStore = async ({
    name,
    phone,
    email,
    gstNumber,
    bankDetails,
    address,
    isActive = true,
    createdBy
}) => {
    await ensureGstColumn();
    await ensureBankColumns();
    const storeCode = await getNextStoreCode();

    const result = await query(
        `INSERT INTO stores (
      name, store_code, phone, email, gst_number,
      bank_name, bank_account_number, bank_ifsc_code, bank_branch_name,
      address_street, address_city, address_state, address_zip_code, address_country,
      is_active, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
            name,
            storeCode,
            phone || null,
            email || null,
            gstNumber || null,
            bankDetails?.bankName || null,
            bankDetails?.accountNumber || null,
            bankDetails?.ifscCode || null,
            bankDetails?.branchName || null,
            address?.street || null,
            address?.city || null,
            address?.state || null,
            address?.zipCode || null,
            address?.country || 'India',
            isActive ? 1 : 0,
            createdBy || null
        ]
    );

    return getStoreById(result.insertId);
};

export const updateStore = async (storeId, updates) => {
    await ensureGstColumn();
    await ensureBankColumns();
    const fields = [];
    const params = [];

    if (updates.name !== undefined) {
        fields.push('name = ?');
        params.push(updates.name);
    }
    if (updates.code !== undefined) {
        fields.push('store_code = ?');
        params.push(updates.code);
    }
    if (updates.phone !== undefined) {
        fields.push('phone = ?');
        params.push(updates.phone || null);
    }
    if (updates.email !== undefined) {
        fields.push('email = ?');
        params.push(updates.email || null);
    }
    if (updates.gstNumber !== undefined) {
        fields.push('gst_number = ?');
        params.push(updates.gstNumber || null);
    }
    if (updates.bankDetails) {
        fields.push(
            'bank_name = ?',
            'bank_account_number = ?',
            'bank_ifsc_code = ?',
            'bank_branch_name = ?'
        );
        params.push(
            updates.bankDetails.bankName || null,
            updates.bankDetails.accountNumber || null,
            updates.bankDetails.ifscCode || null,
            updates.bankDetails.branchName || null
        );
    }
    if (updates.address) {
        fields.push(
            'address_street = ?',
            'address_city = ?',
            'address_state = ?',
            'address_zip_code = ?',
            'address_country = ?'
        );
        params.push(
            updates.address.street || null,
            updates.address.city || null,
            updates.address.state || null,
            updates.address.zipCode || null,
            updates.address.country || 'India'
        );
    }
    if (updates.isActive !== undefined) {
        fields.push('is_active = ?');
        params.push(updates.isActive ? 1 : 0);
    }

    if (fields.length === 0) {
        return getStoreById(storeId);
    }

    fields.push('updated_at = NOW()');

    params.push(storeId);
    await query(`UPDATE stores SET ${fields.join(', ')} WHERE id = ?`, params);

    return getStoreById(storeId);
};

export const deleteStore = async (storeId) => {
    const [{ supplierCount }] = await query(
        'SELECT COUNT(*) AS supplierCount FROM supplier_stores WHERE store_id = ?',
        [storeId]
    );
    if (supplierCount > 0) {
        const error = new Error('Cannot delete store that is associated with suppliers');
        error.code = 'STORE_HAS_SUPPLIERS';
        throw error;
    }

    await query('DELETE FROM stores WHERE id = ?', [storeId]);
};

