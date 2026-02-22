import { validationResult } from 'express-validator';
import pool, { query } from '../db/index.js';
import {
    listStores as listStoresRepository,
    createStore as createStoreRepository,
    updateStore as updateStoreRepository,
    deleteStore as deleteStoreRepository,
    getStoreById as getStoreByIdRepository
} from '../repositories/storeRepository.js';

const SUPPLIER_FIELDS = [
    'Suppliername',
    'Abbreviation',
    'Creationdate',
    'Address1',
    'Address2',
    'Address3',
    'Citycode',
    'State',
    'Pincode',
    'Tngstnumber',
    'Phone',
    'Fax',
    'Email',
    'Tradediscount',
    'Creditdays',
    'Paymentofweek',
    'Suppliertype',
    'Discountoption',
    'OverallDiscountOption',
    'Paymentmode',
    'Productdiscount',
    'Accounttype',
    'Leadtime',
    'Orderschedule',
    'Deliveryschedule',
    'Cstnumber',
    'Dlnumber',
    'Contactperson1',
    'CP1Address1',
    'CP1Address2',
    'CP1Address3',
    'CP1Citycode',
    'CP1State',
    'CP1Pincode',
    'CP1Designation',
    'CP1Phone',
    'CP1MobileNo',
    'CP1Fax',
    'CP1Email',
    'Contactperson2',
    'CP2Address1',
    'CP2Address2',
    'CP2Address3',
    'CP2Citycode',
    'CP2State',
    'CP2Pincode',
    'CP2Designation',
    'CP2Phone',
    'CP2MobileNo',
    'CP2Fax',
    'CP2Email',
    'Placeorder',
    'Producttype',
    'Type',
    'Creditterms',
    'Remarks',
    'Tinnumber',
    'Vatdealertype',
    'Universalsuppliercode',
    'Reworkpurchaseprice',
    'Purchase Orderreturnmode',
    'Purchase Orderreturnpercentage',
    'Calculatetaxforfree',
    'Suppliertoleranceinpercentage',
    'OrdCitycode',
    'Inceptiondate',
    'Transportationmode',
    'Suppliercategorycode',
    'Mobilenumber',
    'StockToSaleRatio',
    'ExpOrDamageSettlement',
    'ModifiedDate',
    'CreatedbyUser',
    'ModifiedbyUser',
    'Importeddate',
    'IsImported',
    'FileName',
    'GrnHeaderInfo',
    'GrnHeaderColWidth',
    'GrnHeaderLockedCol',
    'isActive',
    'ReturnAdjustmentMode',
    'ProdDiscAffectsCost',
    'OverallDiscAffectsCost',
    'MarginBasedOn',
    'FreeAffectCost',
    'ExpiryDamageRateMode',
    'ExpiryDamageLessPercentage',
    'OldCode',
        'Purchase OrderLocation',
    'PrintFormat',
    'SupplierOrderLevel',
    'SupplierOrderRatio',
    'FreeAffectMargin',
    'DlNumber1',
    'IssueSeriesName',
    'LastIssueNo',
    'MrpToleranceAmt',
    'MrpNegativeToleranceAmt',
    'MasterId',
    'Purchase OrderPriceInclExiseDuty',
    'OverallDiscountAffectsMargin',
    'CSTAffectCost',
    'CSTAffectMargin',
    'CSTComputation',
    'ProductDiscountAffectsMargin',
    'ContactPerson1PhoneNo',
    'ContactPerson2PhoneNo',
    'SupplierReturnRemainderFromDate',
    'SupplierReturnRemainderToDate',
    'AccountsPaymentMode',
    'POLoadingOrder',
    'Areacode',
    'AutoMatch',
    'MarkUp',
    'MarkDown',
    'MarkUpRate1',
    'MarkDownRate1',
    'MarkUpRate2',
    'MarkDownRate2',
    'AdditionalCostAffectItemCost',
    'printDo',
    'CCMailId',
    'AllowSMS',
    'LBTApplicable',
    'ExciseDutyCode',
    'AIOCDSupplierCode',
    'BuyerID',
    'PaymentAt',
    'AllowedMailTrans',
    'CurrencyCode',
    'POApprovalRequired',
    'PANNumber',
    'SalesRepMobileNo',
    'DealerType',
    'GSTNumber',
    'TANNumber',
    'UniqueIdentificationNumber',
    'WebOrderEnabled',
    'SupplierUIDNumber',
    'ValidSeries',
    'TransportCode',
    'Distance',
    'SyncId',
    'OpBalEntryDate',
    'DueDateasChequeDate',
    'CreatedAtStoreCode',
    'DueDateCalculation',
    'AutoPOMail',
    'POTerms',
    'EnableforTCS',
    'LoadBottleItem',
    'ConsiderFreeForExpiry',
    'IsGSTINVerified',
    'GSTINVerifiedOn',
    'GSTINStatus',
    'EnableforTDS'
];

const API_TO_DB_FIELD_MAP = {
    Suppliername: 'NAME',
    Suppliercode: 'SUPPLIERCODE',
    Address1: 'STREET',
    Address2: 'ADDRESS1',
    Address3: 'ADDRESS2',
    Citycode: 'CITY',
    State: 'STATE',
    Pincode: 'PINCODE',
    Phone: 'PHONENO',
    Tngstnumber: 'TINNO',
    Area: 'AREA',
    Country: 'COUNTRY',
    Manufacture: 'MANUFACTURE'
};

let supplierColumnMapCache = null;

// Ensure store_id column exists in Suppliers table
const ensureStoreIdColumn = async () => {
    try {
        const columns = await query(`
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'Suppliers' 
              AND COLUMN_NAME = 'store_id'
        `);
        
        if (columns.length === 0) {
            console.log('[Suppliers] Adding store_id column to Suppliers table...');
            await query(`
                ALTER TABLE Suppliers 
                ADD COLUMN store_id BIGINT UNSIGNED NULL AFTER SUPPLIERCODE
            `);
            await query(`CREATE INDEX idx_supplier_store_id ON Suppliers(store_id)`);
            console.log('[Suppliers] store_id column added successfully');
            // Clear cache so column map is refreshed
            supplierColumnMapCache = null;
        }
    } catch (error) {
        // If column already exists or other error, log and continue
        if (error.message && !error.message.includes('Duplicate column name')) {
            console.warn('[Suppliers] Error ensuring store_id column:', error.message);
        }
    }
};

const getSupplierColumnMap = async () => {
    if (supplierColumnMapCache) {
        return supplierColumnMapCache;
    }

    try {
        const columns = await query('DESCRIBE `Suppliers`');
        supplierColumnMapCache = columns.reduce((acc, column) => {
            acc[column.Field.toUpperCase()] = column.Field;
            return acc;
        }, {});
    } catch (error) {
        console.warn('[Suppliers] Unable to describe Suppliers table:', error.message);
        supplierColumnMapCache = null;
    }

    return supplierColumnMapCache;
};

const mapFieldToDbColumn = (field, columnMap) => {
    const override = API_TO_DB_FIELD_MAP[field];
    const preferredField = override || field;
    const normalizedPreferred = preferredField.toUpperCase();

    if (columnMap) {
        if (columnMap[normalizedPreferred]) {
            return columnMap[normalizedPreferred];
        }
        return null;
    }

    return override || null;
};

const transformFieldValue = (field, value) => {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();

        if (trimmed.length === 0) {
            return undefined;
        }

        if (field === 'Suppliername') {
            return trimmed;
        }

        return trimmed;
    }

    return value;
};

const respondValidationErrors = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({
            status: 'error',
            message: 'Validation failed',
            errors: errors.array()
        });
        return true;
    }
    return false;
};

const replicateSupplierNameColumns = (payload, columnMap) => {
    const supplierNameColumn = columnMap?.SUPPLIERNAME;
    const nameColumn = columnMap?.NAME;

    if (!supplierNameColumn && !nameColumn) {
        return;
    }

    const supplierNameValue =
        (nameColumn && payload[nameColumn] !== undefined && payload[nameColumn]) ??
        (supplierNameColumn && payload[supplierNameColumn] !== undefined && payload[supplierNameColumn]);

    if (supplierNameValue === undefined) {
        return;
    }

    if (nameColumn && payload[nameColumn] === undefined) {
        payload[nameColumn] = supplierNameValue;
    }
    if (supplierNameColumn && payload[supplierNameColumn] === undefined) {
        payload[supplierNameColumn] = supplierNameValue;
    }
};

const buildPayload = (body, columnMap) => {
    const payload = {};
    SUPPLIER_FIELDS.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            const dbField = mapFieldToDbColumn(field, columnMap);
            if (!dbField) {
                console.warn(`[Suppliers] Skipping field "${field}" because it does not exist in Suppliers table`);
                return;
            }
            const transformedValue = transformFieldValue(field, body[field]);
            if (transformedValue !== undefined) {
                payload[dbField] = transformedValue;
            }
        }
    });

    if (Object.prototype.hasOwnProperty.call(body, 'Suppliername')) {
        replicateSupplierNameColumns(payload, columnMap);
    }

    return payload;
};

export const listSuppliers = async (req, res) => {
    try {
        const { search, limit = 100 } = req.query;
        const searchTerm = typeof search === 'string' ? search.trim() : undefined;
        const limitValue = Math.min(Number.parseInt(limit, 10) || 100, 1000);

        // First, let's check what tables exist
        try {
            const allTables = await query(
                `SELECT TABLE_NAME 
                 FROM information_schema.TABLES 
                 WHERE TABLE_SCHEMA = DATABASE() 
                 AND TABLE_NAME LIKE '%supplier%'`
            );
            console.log('[Suppliers] Tables with "supplier" in name:', allTables.map(t => t.TABLE_NAME));
        } catch (tableListError) {
            console.warn('[Suppliers] Could not list tables:', tableListError.message);
        }

        // Try different table names
        const possibleTableNames = ['Suppliers', 'suppliers'];
        let tableName = 'Suppliers';
        let suppliers = [];

        // Try to find and query the table
        let tableFound = false;
        for (const name of possibleTableNames) {
            try {
                // Test if table exists by trying a simple query
                await query(`SELECT 1 FROM \`${name}\` LIMIT 1`);
                tableName = name;
                tableFound = true;
                console.log(`[Suppliers] Found table: ${tableName}`);

                // Get table structure to understand columns
                try {
                    const columns = await query(`DESCRIBE \`${tableName}\``);
                    console.log(`[Suppliers] Table columns:`, columns.map(c => c.Field).join(', '));
                } catch (descError) {
                    console.warn('[Suppliers] Could not describe table:', descError.message);
                }

                // Table exists, now query it - use correct column name SUPPLIERCODE
                let sql = `SELECT 
                    \`SUPPLIERCODE\` AS Suppliercode,
                    NAME AS Suppliername,
                    STREET AS Address1,
                    ADDRESS1 AS Address2,
                    ADDRESS2 AS Address3,
                    CITY AS Citycode,
                    STATE AS State,
                    PINCODE AS Pincode,
                    PHONENO AS Phone,
                    TINNO AS Tngstnumber,
                    AREA,
                    COUNTRY,
                    MANUFACTURE,
                    store_id,
                    \`SUPPLIERCODE\` AS id,
                    \`SUPPLIERCODE\` AS _id
                    FROM \`${tableName}\``;
                const params = [];
                const conditions = [];

                if (searchTerm && searchTerm.length > 0) {
                    // Search in NAME, PHONENO columns (actual column names)
                    conditions.push('(NAME LIKE ? OR PHONENO LIKE ?)');
                    const likeValue = `%${searchTerm}%`;
                    params.push(likeValue, likeValue);
                }

                if (conditions.length > 0) {
                    sql += ' WHERE ' + conditions.join(' AND ');
                }

                // Order by the correct column name
                sql += ' ORDER BY \`SUPPLIERCODE\` ASC';

                sql += ' LIMIT ?';
                params.push(limitValue);

                console.log(`[Suppliers] Executing query: ${sql}`);
                console.log(`[Suppliers] Query params:`, params);
                suppliers = await query(sql, params);
                console.log(`[Suppliers] Found ${suppliers.length} suppliers in database`);

                if (suppliers.length > 0) {
                    console.log(`[Suppliers] Sample supplier keys:`, Object.keys(suppliers[0]).join(', '));
                }

                break; // Success, exit loop
            } catch (tableError) {
                console.error(`[Suppliers] Error with table ${name}:`, tableError.message);
                console.error(`[Suppliers] Error code:`, tableError.code);
                console.error(`[Suppliers] SQL error:`, tableError.sqlMessage);
                // Table doesn't exist or error querying, try next name
                if (name === possibleTableNames[possibleTableNames.length - 1]) {
                    // Last table name, table doesn't exist
                    console.warn('[Suppliers] Suppliers table does not exist or cannot be accessed');
                    if (!tableFound) {
                        return res.json({
                            status: 'success',
                            data: {
                                suppliers: []
                            }
                        });
                    }
                }
                continue; // Try next table name
            }
        }

        if (!tableFound) {
            console.warn('[Suppliers] No Suppliers table found, returning empty array');
            return res.json({
                status: 'success',
                data: {
                    suppliers: []
                }
            });
        }

        // Ensure store_id column exists
        await ensureStoreIdColumn();
        
        // Fetch store associations from supplier_stores table
        const supplierCodes = suppliers.map(s => s.Suppliercode || s.id || s._id).filter(Boolean);
        let storeAssociations = {};
        
        if (supplierCodes.length > 0) {
            try {
                // Check if supplier_stores table exists
                await query('SELECT 1 FROM supplier_stores LIMIT 1');
                
                // Fetch all store associations for these suppliers
                const placeholders = supplierCodes.map(() => '?').join(',');
                const storeRows = await query(
                    `SELECT ss.supplier_id, ss.store_id, s.id as storeId, s.name as storeName, s.code as storeCode
                     FROM supplier_stores ss
                     LEFT JOIN stores s ON ss.store_id = s.id
                     WHERE ss.supplier_id IN (${placeholders})`,
                    supplierCodes
                );
                
                // Group stores by supplier_id
                storeAssociations = storeRows.reduce((acc, row) => {
                    const supplierId = row.supplier_id;
                    if (!acc[supplierId]) {
                        acc[supplierId] = [];
                    }
                    if (row.store_id) {
                        acc[supplierId].push({
                            store: {
                                _id: row.storeId || row.store_id,
                                id: row.storeId || row.store_id,
                                storeId: row.storeId || row.store_id,
                                name: row.storeName || '',
                                code: row.storeCode || ''
                            },
                            store_id: row.store_id
                        });
                    }
                    return acc;
                }, {});
            } catch (storeError) {
                // If supplier_stores table doesn't exist, continue without stores
                console.warn('[Suppliers] Could not fetch store associations:', storeError.message);
            }
        }
        
        // Transform to match expected format
        const formattedSuppliers = suppliers.map((supplier) => {
            // Map the actual database columns to expected format
            const supplierCode = supplier.Suppliercode || supplier.id || supplier._id;
            const supplierName = supplier.Suppliername || supplier.NAME || '';
            const phone = supplier.Phone || supplier.PHONENO || '';
            const storeId = supplier.store_id || null;
            
            // Get stores for this supplier from the associations
            const supplierStores = storeAssociations[supplierCode] || [];

            const formatted = {
                _id: supplierCode,
                id: supplierCode,
                Suppliercode: supplierCode,
                Suppliername: supplierName,
                Email: '', // Not in the table structure shown
                Phone: phone ? String(phone) : '',
                Address1: supplier.Address1 || supplier.STREET || '',
                Address2: supplier.Address2 || supplier.ADDRESS1 || '',
                Address3: supplier.Address3 || supplier.ADDRESS2 || '',
                Citycode: supplier.Citycode || supplier.CITY || '',
                State: supplier.State || supplier.STATE || '',
                Pincode: supplier.Pincode || supplier.PINCODE || '',
                isActive: 1, // Default to active
                store_id: storeId, // Include store_id from Suppliers table
                stores: supplierStores, // Include stores from supplier_stores table
                // Add fields expected by frontend
                companyName: supplierName,
                contactPerson: {
                    firstName: '',
                    lastName: '',
                    designation: ''
                },
                email: '',
                phone: {
                    primary: phone ? String(phone) : '',
                    secondary: ''
                },
                address: {
                    street: supplier.Address1 || supplier.STREET || '',
                    city: supplier.Citycode || supplier.CITY || '',
                    state: supplier.State || supplier.STATE || '',
                    zipCode: supplier.Pincode ? String(supplier.Pincode) : (supplier.PINCODE ? String(supplier.PINCODE) : ''),
                    country: supplier.COUNTRY || 'India'
                },
                gstNumber: supplier.Tngstnumber || supplier.TINNO || '',
                panNumber: '',
                // Include all original fields
                ...supplier
            };

            return formatted;
        });

        console.log(`[Suppliers] Returning ${formattedSuppliers.length} formatted suppliers`);

        res.json({
            status: 'success',
            data: {
                suppliers: formattedSuppliers
            }
        });
    } catch (error) {
        console.error('Error listing suppliers:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            sqlMessage: error.sqlMessage,
            sqlState: error.sqlState
        });

        // Return empty array instead of error to prevent frontend crashes
        res.json({
            status: 'success',
            data: {
                suppliers: []
            }
        });
    }
};

export const getSupplierByCode = async (req, res) => {
    try {
        const supplierCode = Number(req.params.supplierCode);
        if (!Number.isInteger(supplierCode) || supplierCode <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid supplier code'
            });
        }

        const rows = await query(
            'SELECT * FROM Suppliers WHERE SUPPLIERCODE = ?',
            [supplierCode]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Supplier not found'
            });
        }

        const supplier = rows[0];
        const storeId = supplier.store_id || null;
        
        // Fetch store associations from supplier_stores table
        let supplierStores = [];
        try {
            const storeRows = await query(
                `SELECT ss.supplier_id, ss.store_id, s.id as storeId, s.name as storeName, s.code as storeCode
                 FROM supplier_stores ss
                 LEFT JOIN stores s ON ss.store_id = s.id
                 WHERE ss.supplier_id = ?`,
                [supplierCode]
            );
            
            supplierStores = storeRows.map(row => ({
                store: {
                    _id: row.storeId || row.store_id,
                    id: row.storeId || row.store_id,
                    storeId: row.storeId || row.store_id,
                    name: row.storeName || '',
                    code: row.storeCode || ''
                },
                store_id: row.store_id
            }));
        } catch (storeError) {
            console.warn('[Suppliers] Could not fetch store associations:', storeError.message);
        }
        
        const formattedSupplier = {
            _id: supplier.Suppliercode,
            id: supplier.Suppliercode,
            Suppliercode: supplier.Suppliercode,
            Suppliername: supplier.Suppliername,
            Email: supplier.Email,
            Phone: supplier.Phone,
            store_id: storeId, // Include store_id from Suppliers table
            stores: supplierStores, // Include stores from supplier_stores table
            ...supplier
        };

        res.json({
            status: 'success',
            data: formattedSupplier
        });
    } catch (error) {
        console.error('Error fetching supplier:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while fetching supplier'
        });
    }
};

const parseBoolean = (value) => {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'no', 'off'].includes(normalized)) {
            return false;
        }
    }

    return undefined;
};

const buildStorePayload = (body) => {
    const payload = {};

    if (body.name !== undefined) {
        payload.name = typeof body.name === 'string' ? body.name.trim() : body.name;
    }

    if (body.phone !== undefined) {
        payload.phone = body.phone === null ? null : String(body.phone).trim();
    }

    if (body.email !== undefined) {
        payload.email = body.email === null ? null : String(body.email).trim().toLowerCase();
    }

    if (body.gstNumber !== undefined) {
        payload.gstNumber = body.gstNumber === null ? null : String(body.gstNumber).trim().toUpperCase();
    }

    if (body.managerName !== undefined) {
        payload.managerName = body.managerName === null ? null : String(body.managerName).trim();
    }

    if (
        body.bankDetails !== undefined ||
        body.bankName !== undefined ||
        body.bankAccountNumber !== undefined ||
        body.bankIfscCode !== undefined ||
        body.bankBranchName !== undefined
    ) {
        const bankDetails = body.bankDetails && typeof body.bankDetails === 'object' ? body.bankDetails : {};
        payload.bankDetails = {
            bankName:
                body.bankName !== undefined
                    ? (body.bankName === null ? null : String(body.bankName).trim())
                    : bankDetails.bankName !== undefined
                        ? (bankDetails.bankName === null ? null : String(bankDetails.bankName).trim())
                        : undefined,
            accountNumber:
                body.bankAccountNumber !== undefined
                    ? (body.bankAccountNumber === null ? null : String(body.bankAccountNumber).trim())
                    : bankDetails.accountNumber !== undefined
                        ? (bankDetails.accountNumber === null ? null : String(bankDetails.accountNumber).trim())
                        : undefined,
            ifscCode:
                body.bankIfscCode !== undefined
                    ? (body.bankIfscCode === null ? null : String(body.bankIfscCode).trim().toUpperCase())
                    : bankDetails.ifscCode !== undefined
                        ? (bankDetails.ifscCode === null ? null : String(bankDetails.ifscCode).trim().toUpperCase())
                        : undefined,
            branchName:
                body.bankBranchName !== undefined
                    ? (body.bankBranchName === null ? null : String(body.bankBranchName).trim())
                    : bankDetails.branchName !== undefined
                        ? (bankDetails.branchName === null ? null : String(bankDetails.branchName).trim())
                        : undefined
        };
    }

    if (
        body.address !== undefined ||
        body.addressStreet !== undefined ||
        body.addressCity !== undefined ||
        body.addressState !== undefined ||
        body.addressZipCode !== undefined ||
        body.addressCountry !== undefined
    ) {
        const address = body.address && typeof body.address === 'object' ? body.address : {};
        payload.address = {
            street:
                body.addressStreet !== undefined
                    ? body.addressStreet
                    : address.street !== undefined
                        ? address.street
                        : undefined,
            city:
                body.addressCity !== undefined
                    ? body.addressCity
                    : address.city !== undefined
                        ? address.city
                        : undefined,
            state:
                body.addressState !== undefined
                    ? body.addressState
                    : address.state !== undefined
                        ? address.state
                        : undefined,
            zipCode:
                body.addressZipCode !== undefined
                    ? body.addressZipCode
                    : address.zipCode !== undefined
                        ? address.zipCode
                        : undefined,
            country:
                body.addressCountry !== undefined
                    ? body.addressCountry
                    : address.country !== undefined
                        ? address.country
                        : undefined
        };
    }

    if (body.isActive !== undefined) {
        const parsed = parseBoolean(body.isActive);
        if (parsed !== undefined) {
            payload.isActive = parsed;
        }
    }

    return payload;
};

const hasStoreFields = (payload) => {
    return Object.keys(payload).some((key) => {
        if (key === 'address' || key === 'bankDetails') {
            if (!payload[key] || typeof payload[key] !== 'object') {
                return false;
            }
            return Object.values(payload[key]).some((value) => value !== undefined);
        }
        return payload[key] !== undefined;
    });
};

export const listStores = async (req, res) => {
    try {
        const { search } = req.query;
        const searchTerm = typeof search === 'string' ? search.trim() : undefined;
        const isActive = parseBoolean(req.query?.isActive);

        const stores = await listStoresRepository({
            search: searchTerm && searchTerm.length > 0 ? searchTerm : undefined,
            isActive
        });

        res.json({
            status: 'success',
            data: {
                stores
            }
        });
    } catch (error) {
        console.error('Error listing stores:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while fetching stores'
        });
    }
};

export const createStore = async (req, res) => {
    try {
        const payload = buildStorePayload(req.body);

        if (!payload.name || typeof payload.name !== 'string' || payload.name.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Store name is required'
            });
        }

        const store = await createStoreRepository(payload);

        res.status(201).json({
            status: 'success',
            message: 'Store created successfully',
            data: {
                store
            }
        });
    } catch (error) {
        console.error('Error creating store:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while creating store'
        });
    }
};

export const updateStore = async (req, res) => {
    try {
        const storeId = Number(req.params.storeId);
        if (!Number.isInteger(storeId) || storeId <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid store id'
            });
        }

        const existingStore = await getStoreByIdRepository(storeId);

        if (!existingStore) {
            return res.status(404).json({
                status: 'error',
                message: 'Store not found'
            });
        }

        const payload = buildStorePayload(req.body);

        if (!hasStoreFields(payload)) {
            return res.status(400).json({
                status: 'error',
                message: 'No valid fields supplied for update'
            });
        }

        const updatedStore = await updateStoreRepository(storeId, payload);

        res.json({
            status: 'success',
            message: 'Store updated successfully',
            data: {
                store: updatedStore
            }
        });
    } catch (error) {
        console.error('Error updating store:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while updating store'
        });
    }
};

export const deleteStore = async (req, res) => {
    try {
        const storeId = Number(req.params.storeId);
        if (!Number.isInteger(storeId) || storeId <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid store id'
            });
        }

        const existingStore = await getStoreByIdRepository(storeId);

        if (!existingStore) {
            return res.status(404).json({
                status: 'error',
                message: 'Store not found'
            });
        }

        await deleteStoreRepository(storeId);

        res.json({
            status: 'success',
            message: 'Store deleted successfully'
        });
    } catch (error) {
        if (error?.code === 'STORE_HAS_SUPPLIERS') {
            return res.status(400).json({
                status: 'error',
                message: error.message || 'Cannot delete store that is associated with suppliers'
            });
        }

        console.error('Error deleting store:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while deleting store'
        });
    }
};

export const createSupplier = async (req, res) => {
    if (respondValidationErrors(req, res)) return;

    try {
        // Ensure store_id column exists before processing
        await ensureStoreIdColumn();
        
        const columnMap = await getSupplierColumnMap();
        const payload = buildPayload(req.body, columnMap);

        // Handle store_id separately since it's not in SUPPLIER_FIELDS
        let storeId = undefined;
        if (req.body.store_id !== undefined && req.body.store_id !== null) {
            const normalizedStoreId = Number(req.body.store_id);
            if (Number.isInteger(normalizedStoreId) && normalizedStoreId > 0) {
                storeId = normalizedStoreId;
            } else if (req.body.store_id === null || req.body.store_id === '') {
                storeId = null; // Allow setting to NULL
            }
        }

        if (Object.keys(payload).length === 0 && storeId === undefined) {
            return res.status(400).json({
                status: 'error',
                message: 'No valid supplier fields provided'
            });
        }

        // Build INSERT query
        const fields = Object.keys(payload);
        if (storeId !== undefined) {
            fields.push('store_id');
        }
        
        if (fields.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No valid supplier fields provided'
            });
        }

        const placeholders = fields.map(() => '?').join(', ');
        const values = fields.map(field => {
            if (field === 'store_id') {
                return storeId;
            }
            return payload[field];
        });

        const sql = `INSERT INTO Suppliers (${fields.join(', ')}) VALUES (${placeholders})`;
        const [result] = await pool.query(sql, values);
        const insertId = result.insertId;

        // Fetch the created supplier
        const rows = await query(
            'SELECT * FROM Suppliers WHERE SUPPLIERCODE = ?',
            [insertId]
        );

        const supplier = rows[0];
        const fetchedStoreId = supplier.store_id || null;
        
        // Handle store associations if stores array is provided
        if (Array.isArray(req.body.stores) && req.body.stores.length > 0) {
            try {
                const storeValues = req.body.stores
                    .map(storeId => {
                        const normalizedStoreId = Number(storeId);
                        if (Number.isInteger(normalizedStoreId) && normalizedStoreId > 0) {
                            return [insertId, normalizedStoreId];
                        }
                        return null;
                    })
                    .filter(Boolean);

                if (storeValues.length > 0) {
                    const placeholders = storeValues.map(() => '(?, ?)').join(', ');
                    const flatValues = storeValues.flat();
                    await query(
                        `INSERT INTO supplier_stores (supplier_id, store_id) VALUES ${placeholders}`,
                        flatValues
                    );
                }
            } catch (storeError) {
                console.error('Error creating supplier stores:', storeError);
            }
        }
        
        // Fetch store associations from supplier_stores table
        let supplierStores = [];
        try {
            const storeRows = await query(
                `SELECT ss.supplier_id, ss.store_id, s.id as storeId, s.name as storeName, s.code as storeCode
                 FROM supplier_stores ss
                 LEFT JOIN stores s ON ss.store_id = s.id
                 WHERE ss.supplier_id = ?`,
                [insertId]
            );
            
            supplierStores = storeRows.map(row => ({
                store: {
                    _id: row.storeId || row.store_id,
                    id: row.storeId || row.store_id,
                    storeId: row.storeId || row.store_id,
                    name: row.storeName || '',
                    code: row.storeCode || ''
                },
                store_id: row.store_id
            }));
        } catch (storeError) {
            console.warn('[Suppliers] Could not fetch store associations:', storeError.message);
        }
        
        const formattedSupplier = {
            _id: supplier.Suppliercode,
            id: supplier.Suppliercode,
            store_id: fetchedStoreId, // Include store_id from Suppliers table
            stores: supplierStores, // Include stores from supplier_stores table
            ...supplier
        };

        res.status(201).json({
            status: 'success',
            message: 'Supplier created successfully',
            data: formattedSupplier
        });
    } catch (error) {
        console.error('Error creating supplier:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while creating supplier'
        });
    }
};

export const updateSupplier = async (req, res) => {
    if (respondValidationErrors(req, res)) return;

    try {
        // Log the incoming request body for debugging
        console.log('[UpdateSupplier] Request body keys:', Object.keys(req.body));
        console.log('[UpdateSupplier] Request body stores:', req.body.stores);
        console.log('[UpdateSupplier] Request body stores type:', typeof req.body.stores, Array.isArray(req.body.stores));
        
        // Ensure store_id column exists before processing
        await ensureStoreIdColumn();
        
        const supplierCode = Number(req.params.supplierCode);

        // Check if supplier exists
        const existingRows = await query(
            'SELECT * FROM Suppliers WHERE SUPPLIERCODE = ?',
            [supplierCode]
        );

        if (existingRows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Supplier not found'
            });
        }

        const columnMap = await getSupplierColumnMap();
        const payload = buildPayload(req.body, columnMap);

        // Handle store_id separately since it's not in SUPPLIER_FIELDS
        let storeId = undefined;
        if (req.body.store_id !== undefined && req.body.store_id !== null) {
            const normalizedStoreId = Number(req.body.store_id);
            if (Number.isInteger(normalizedStoreId) && normalizedStoreId > 0) {
                storeId = normalizedStoreId;
            } else if (req.body.store_id === null || req.body.store_id === '') {
                storeId = null; // Allow setting to NULL
            }
        }

        // If no fields in payload and no store_id, return error
        if (Object.keys(payload).length === 0 && storeId === undefined) {
            return res.status(400).json({
                status: 'error',
                message: 'No valid fields supplied for update'
            });
        }

        // Build UPDATE query
        const fields = Object.keys(payload);
        if (storeId !== undefined) {
            fields.push('store_id');
        }
        
        if (fields.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No valid fields supplied for update'
            });
        }

        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => {
            if (field === 'store_id') {
                return storeId;
            }
            return payload[field];
        });
        values.push(supplierCode);

        await query(
            `UPDATE Suppliers SET ${setClause} WHERE SUPPLIERCODE = ?`,
            values
        );

        // Handle store updates if stores array is provided
        // Note: We process stores array even if it's empty (to clear all associations)
        if (Array.isArray(req.body.stores)) {
            console.log(`[UpdateSupplier] Processing stores array for supplier ${supplierCode}:`, req.body.stores);
            try {
                // First, delete all existing store associations for this supplier
                const deleteResult = await query(
                    'DELETE FROM supplier_stores WHERE supplier_id = ?',
                    [supplierCode]
                );
                console.log(`[UpdateSupplier] Deleted existing store associations for supplier ${supplierCode}`, deleteResult);

                // Then, insert new store associations (if any)
                if (req.body.stores.length > 0) {
                    const storeValues = req.body.stores
                        .map(storeId => {
                            const normalizedStoreId = Number(storeId);
                            console.log(`[UpdateSupplier] Processing storeId: ${storeId} -> normalized: ${normalizedStoreId}`);
                            if (Number.isInteger(normalizedStoreId) && normalizedStoreId > 0) {
                                return [supplierCode, normalizedStoreId];
                            }
                            console.warn(`[UpdateSupplier] Invalid storeId: ${storeId} (normalized: ${normalizedStoreId})`);
                            return null;
                        })
                        .filter(Boolean);

                    console.log(`[UpdateSupplier] Valid store values to insert:`, storeValues);

                    if (storeValues.length > 0) {
                        const placeholders = storeValues.map(() => '(?, ?)').join(', ');
                        const flatValues = storeValues.flat();
                        const insertSql = `INSERT INTO supplier_stores (supplier_id, store_id) VALUES ${placeholders}`;
                        console.log(`[UpdateSupplier] Executing SQL: ${insertSql} with values:`, flatValues);
                        const insertResult = await query(insertSql, flatValues);
                        console.log(`[UpdateSupplier] Successfully inserted ${storeValues.length} store associations`, insertResult);
                    } else {
                        console.warn(`[UpdateSupplier] No valid store values to insert after filtering`);
                    }
                } else {
                    console.log(`[UpdateSupplier] Stores array is empty, all associations cleared for supplier ${supplierCode}`);
                }
            } catch (storeError) {
                // Log error but don't fail the entire update
                console.error('[UpdateSupplier] Error updating supplier stores:', storeError);
                console.error('[UpdateSupplier] Error details:', {
                    message: storeError.message,
                    code: storeError.code,
                    sqlMessage: storeError.sqlMessage,
                    sql: storeError.sql,
                    stack: storeError.stack
                });
                // Check if supplier_stores table exists
                try {
                    await query('SELECT 1 FROM supplier_stores LIMIT 1');
                    console.error('[UpdateSupplier] supplier_stores table exists, but error occurred during update');
                    // Don't re-throw - allow supplier update to succeed even if store update fails
                } catch (tableError) {
                    console.warn('[UpdateSupplier] supplier_stores table may not exist, skipping store updates');
                }
            }
        } else {
            console.log(`[UpdateSupplier] No stores array provided in request body. Body keys:`, Object.keys(req.body));
        }

        // Fetch updated supplier
        const updatedRows = await query(
            'SELECT * FROM Suppliers WHERE SUPPLIERCODE = ?',
            [supplierCode]
        );

        const supplier = updatedRows[0];
        const fetchedStoreId = supplier.store_id || null;
        
        // Fetch store associations from supplier_stores table
        let supplierStores = [];
        try {
            console.log(`[UpdateSupplier] Fetching stores for supplier ${supplierCode} from supplier_stores table`);
            const storeRows = await query(
                `SELECT ss.supplier_id, ss.store_id, s.id as storeId, s.name as storeName, s.code as storeCode
                 FROM supplier_stores ss
                 LEFT JOIN stores s ON ss.store_id = s.id
                 WHERE ss.supplier_id = ?`,
                [supplierCode]
            );
            
            console.log(`[UpdateSupplier] Found ${storeRows.length} store associations in database:`, storeRows);
            
            supplierStores = storeRows.map(row => {
                const storeData = {
                    store: {
                        _id: row.storeId || row.store_id,
                        id: row.storeId || row.store_id,
                        storeId: row.storeId || row.store_id,
                        name: row.storeName || '',
                        code: row.storeCode || ''
                    },
                    store_id: row.store_id
                };
                console.log(`[UpdateSupplier] Mapped store:`, storeData);
                return storeData;
            });
            
            console.log(`[UpdateSupplier] Final supplierStores array with ${supplierStores.length} stores:`, JSON.stringify(supplierStores, null, 2));
        } catch (storeError) {
            console.error('[UpdateSupplier] Could not fetch store associations:', storeError);
            console.error('[UpdateSupplier] Error details:', {
                message: storeError.message,
                code: storeError.code,
                sqlMessage: storeError.sqlMessage
            });
        }
        
        const formattedSupplier = {
            _id: supplier.Suppliercode,
            id: supplier.Suppliercode,
            store_id: fetchedStoreId, // Include store_id from Suppliers table
            stores: supplierStores, // Include stores from supplier_stores table
            ...supplier
        };

        console.log(`[UpdateSupplier] Returning supplier with ${supplierStores.length} stores:`, {
            supplierId: formattedSupplier._id,
            store_id: formattedSupplier.store_id,
            storesCount: formattedSupplier.stores.length,
            stores: formattedSupplier.stores.map(s => ({
                storeId: s.store?.id || s.store_id,
                name: s.store?.name,
                code: s.store?.code
            }))
        });

        res.json({
            status: 'success',
            message: 'Supplier updated successfully',
            data: formattedSupplier
        });
    } catch (error) {
        console.error('Error updating supplier:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while updating supplier'
        });
    }
};

export const deleteSupplier = async (req, res) => {
    try {
        const supplierCode = Number(req.params.supplierCode);

        // Check if supplier exists
        const existingRows = await query(
            'SELECT * FROM Suppliers WHERE SUPPLIERCODE = ?',
            [supplierCode]
        );

        if (existingRows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Supplier not found'
            });
        }

        await query(
            'DELETE FROM Suppliers WHERE SUPPLIERCODE = ?',
            [supplierCode]
        );

        res.json({
            status: 'success',
            message: 'Supplier deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while deleting supplier'
        });
    }
};

export const addStoreToSupplier = async (req, res) => {
    try {
        const supplierCode = Number(req.params.supplierCode);
        const { storeId } = req.body;

        if (!Number.isInteger(supplierCode) || supplierCode <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid supplier code'
            });
        }

        if (!storeId) {
            return res.status(400).json({
                status: 'error',
                message: 'Store ID is required'
            });
        }

        const normalizedStoreId = Number(storeId);
        if (!Number.isInteger(normalizedStoreId) || normalizedStoreId <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid store ID'
            });
        }

        // Check if supplier exists
        const supplierRows = await query(
            'SELECT * FROM Suppliers WHERE SUPPLIERCODE = ?',
            [supplierCode]
        );

        if (supplierRows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Supplier not found'
            });
        }

        // Check if store exists
        const storeRows = await query(
            'SELECT * FROM stores WHERE id = ?',
            [normalizedStoreId]
        );

        if (storeRows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Store not found'
            });
        }

        // Check if association already exists
        try {
            const existingRows = await query(
                'SELECT * FROM supplier_stores WHERE supplier_id = ? AND store_id = ?',
                [supplierCode, normalizedStoreId]
            );

            if (existingRows.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Store is already associated with this supplier'
                });
            }

            // Insert new association
            await query(
                'INSERT INTO supplier_stores (supplier_id, store_id) VALUES (?, ?)',
                [supplierCode, normalizedStoreId]
            );
        } catch (storeError) {
            // Check if supplier_stores table exists
            if (storeError.code === 'ER_NO_SUCH_TABLE') {
                console.warn('supplier_stores table does not exist');
                return res.status(400).json({
                    status: 'error',
                    message: 'Store association feature is not available'
                });
            }
            throw storeError;
        }

        // Fetch updated supplier
        const updatedRows = await query(
            'SELECT * FROM Suppliers WHERE SUPPLIERCODE = ?',
            [supplierCode]
        );

        const supplier = updatedRows[0];
        const formattedSupplier = {
            _id: supplier.Suppliercode,
            id: supplier.Suppliercode,
            ...supplier
        };

        res.json({
            status: 'success',
            message: 'Store added to supplier successfully',
            data: formattedSupplier
        });
    } catch (error) {
        console.error('Error adding store to supplier:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while adding store to supplier'
        });
    }
};

export const removeStoreFromSupplier = async (req, res) => {
    try {
        const supplierCode = Number(req.params.supplierCode);
        const storeId = Number(req.params.storeId);

        if (!Number.isInteger(supplierCode) || supplierCode <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid supplier code'
            });
        }

        if (!Number.isInteger(storeId) || storeId <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid store ID'
            });
        }

        // Check if supplier exists
        const supplierRows = await query(
            'SELECT * FROM Suppliers WHERE SUPPLIERCODE = ?',
            [supplierCode]
        );

        if (supplierRows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Supplier not found'
            });
        }

        // Delete association
        try {
            const result = await query(
                'DELETE FROM supplier_stores WHERE supplier_id = ? AND store_id = ?',
                [supplierCode, storeId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Store association not found'
                });
            }
        } catch (storeError) {
            // Check if supplier_stores table exists
            if (storeError.code === 'ER_NO_SUCH_TABLE') {
                console.warn('supplier_stores table does not exist');
                return res.status(400).json({
                    status: 'error',
                    message: 'Store association feature is not available'
                });
            }
            throw storeError;
        }

        // Fetch updated supplier
        const updatedRows = await query(
            'SELECT * FROM Suppliers WHERE SUPPLIERCODE = ?',
            [supplierCode]
        );

        const supplier = updatedRows[0];
        const formattedSupplier = {
            _id: supplier.Suppliercode,
            id: supplier.Suppliercode,
            ...supplier
        };

        res.json({
            status: 'success',
            message: 'Store removed from supplier successfully',
            data: formattedSupplier
        });
    } catch (error) {
        console.error('Error removing store from supplier:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error while removing store from supplier'
        });
    }
};
