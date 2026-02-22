import { query } from '../db/index.js';
import { getUserById } from '../repositories/userRepository.js';

const normalizeStoreId = (value) => {
    if (value === null || value === undefined) {
        return null;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
};

const getSelectedStoreId = async (user) => {
    if (user?.selectedStore?.id) {
        return normalizeStoreId(user.selectedStore.id);
    }
    const userId = user?._id ?? user?.id;
    if (!userId) {
        return null;
    }
    const freshUser = await getUserById(userId);
    return normalizeStoreId(freshUser?.selectedStore?.id) || null;
};

const formatDateTime = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

const fetchTotalSuppliers = async (storeId = null) => {
    try {
        // If no store ID provided, return 0 (should not happen in dashboard)
        if (!storeId) {
            console.log('[Dashboard] No store ID provided, returning 0 suppliers');
            return { totalSuppliers: 0 };
        }
        
        console.log(`[Dashboard] Fetching suppliers for store ID: ${storeId}`);
        
        // First, check if Suppliers table has store_id column
        let hasStoreIdColumn = false;
        try {
            const [columnCheck] = await query(
                `SELECT COLUMN_NAME 
                 FROM information_schema.COLUMNS 
                 WHERE TABLE_SCHEMA = DATABASE() 
                 AND TABLE_NAME = 'Suppliers'
                 AND COLUMN_NAME = 'store_id'`
            );
            hasStoreIdColumn = columnCheck && columnCheck.COLUMN_NAME === 'store_id';
        } catch (columnCheckError) {
            console.warn('[Dashboard] Could not check for store_id column in Suppliers table:', columnCheckError.message);
        }
        
        // If Suppliers table has store_id column, query directly
        if (hasStoreIdColumn) {
            try {
                const [result] = await query(
                    `SELECT COUNT(*) AS totalSuppliers 
                     FROM Suppliers 
                     WHERE store_id = ?`,
                    [storeId]
                );
                const count = Number(result?.totalSuppliers || 0);
                console.log(`[Dashboard] Found ${count} suppliers in Suppliers table for store ${storeId}`);
                return { totalSuppliers: count };
            } catch (queryError) {
                console.error('[Dashboard] Error querying Suppliers table:', queryError.message);
                // Fall through to try supplier_stores join
            }
        }
        
        // Fallback: Try using supplier_stores join table
        let tableExists = false;
        try {
            const [tableCheck] = await query(
                `SELECT COUNT(*) AS tableExists 
                 FROM information_schema.TABLES 
                 WHERE TABLE_SCHEMA = DATABASE() 
                 AND TABLE_NAME = 'supplier_stores'`
            );
            tableExists = Number(tableCheck?.tableExists || 0) > 0;
        } catch (tableCheckError) {
            console.warn('[Dashboard] Could not check if supplier_stores table exists:', tableCheckError.message);
        }
        
        if (tableExists) {
            try {
                const [linkedResult] = await query(
                    `SELECT COUNT(DISTINCT s.SUPPLIERCODE) AS totalSuppliers 
                     FROM Suppliers s
                     INNER JOIN supplier_stores ss ON s.SUPPLIERCODE = ss.supplier_id
                     WHERE ss.store_id = ?`,
                    [storeId]
                );
                const linkedCount = Number(linkedResult?.totalSuppliers || 0);
                console.log(`[Dashboard] Found ${linkedCount} suppliers linked to store ${storeId} via supplier_stores`);
                return { totalSuppliers: linkedCount };
            } catch (joinError) {
                console.error('[Dashboard] Join query failed:', joinError.message);
                // Try alternative query
                try {
                    const [altResult] = await query(
                        `SELECT COUNT(DISTINCT supplier_id) AS totalSuppliers 
                         FROM supplier_stores 
                         WHERE store_id = ?`,
                        [storeId]
                    );
                    const altCount = Number(altResult?.totalSuppliers || 0);
                    console.log(`[Dashboard] Alternative query found ${altCount} suppliers for store ${storeId}`);
                    return { totalSuppliers: altCount };
                } catch (altError) {
                    console.error('[Dashboard] Alternative query also failed:', altError.message);
                }
            }
        }
        
        // If neither method works, return 0
        console.log('[Dashboard] Could not fetch supplier count, returning 0');
        return { totalSuppliers: 0 };
    } catch (error) {
        console.error('[Dashboard] Failed to fetch supplier count:', error.message || error);
        console.error('[Dashboard] Error details:', {
            code: error.code,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage,
            storeId: storeId
        });
        // Return 0 on error to ensure we don't show incorrect data
        return { totalSuppliers: 0 };
    }
};

export const getDashboardStats = async (req, res) => {
    try {
        const storeId = await getSelectedStoreId(req.user);
        if (!storeId) {
            return res.status(400).json({
                success: false,
                message: 'Please select a store before viewing the dashboard.'
            });
        }

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startOfYesterday = new Date(startOfDay);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfWeek.getDate() - 6);
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        let salesTotals = { totalSales: 0, totalBills: 0 };
        let todaySales = { totalSales: 0, totalBills: 0 };
        let yesterdaySales = { totalSales: 0 };
        let lastWeekSales = { totalSales: 0 };
        let weeklySales = [];
        let totalCustomers = { totalCustomers: 0 };
        let newCustomersToday = { newCustomers: 0 };
        let itemsAddedThisMonth = { count: 0 };
        let lowStockItems = [];

        try {
            [salesTotals] = await query(
                `SELECT 
           COALESCE(SUM(total), 0) AS totalSales,
           COUNT(*) AS totalBills
         FROM bills
         WHERE store_id = ?`,
                [storeId]
            );

            [todaySales] = await query(
                `SELECT COALESCE(SUM(total), 0) AS totalSales, COUNT(*) AS totalBills
         FROM bills
         WHERE store_id = ? AND date >= ?`,
                [storeId, formatDateTime(startOfDay)]
            );

            [yesterdaySales] = await query(
                `SELECT COALESCE(SUM(total), 0) AS totalSales
         FROM bills
         WHERE store_id = ? AND date >= ? AND date < ?`,
                [storeId, formatDateTime(startOfYesterday), formatDateTime(startOfDay)]
            );

            [lastWeekSales] = await query(
                `SELECT COALESCE(SUM(total), 0) AS totalSales
         FROM bills
         WHERE store_id = ? AND date >= ? AND date < ?`,
                [storeId, formatDateTime(startOfWeek), formatDateTime(startOfDay)]
            );

            weeklySales = await query(
                `SELECT DATE(date) AS saleDate, COALESCE(SUM(total), 0) AS totalSales
         FROM bills
         WHERE store_id = ? AND date >= ?
         GROUP BY DATE(date)
         ORDER BY saleDate ASC`,
                [storeId, formatDateTime(startOfWeek)]
            );

            [totalCustomers] = await query(
                `SELECT 
           (SELECT COUNT(DISTINCT customer_name) 
            FROM bills 
            WHERE store_id = ? AND customer_name IS NOT NULL AND customer_name <> '')
           +
           (SELECT COUNT(*) 
            FROM bills 
            WHERE store_id = ? AND (customer_name IS NULL OR customer_name = ''))
           AS totalCustomers`,
                [storeId, storeId]
            );

            [newCustomersToday] = await query(
                `SELECT 
           (SELECT COUNT(*) 
            FROM (
              SELECT customer_name, MIN(date) AS first_purchase
              FROM bills
              WHERE store_id = ? AND customer_name IS NOT NULL AND customer_name <> ''
              GROUP BY customer_name
            ) AS customer_first_purchase
            WHERE first_purchase >= ?)
           +
           (SELECT COUNT(*) 
            FROM bills 
            WHERE store_id = ? AND (customer_name IS NULL OR customer_name = '') AND date >= ?)
           AS newCustomers`,
                [storeId, formatDateTime(startOfDay), storeId, formatDateTime(startOfDay)]
            );
        } catch (error) {
            console.warn('Dashboard sales queries skipped:', error?.message || error);
        }

        // Fetch items added this month
        try {
            let itemsQuery = '';
            let itemsParams = [];
            
            // Check if Products table has store_id column
            const storeIdColumnCheck = await query(`
                SELECT COLUMN_NAME 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'Products'
                AND COLUMN_NAME = 'store_id'
            `);
            
            const hasStoreIdInProducts = storeIdColumnCheck.length > 0;
            
            // Use Products table (Products table uses CreationDate instead of created_at)
            if (hasStoreIdInProducts) {
                // Use Products table with store_id filter
                itemsQuery = `SELECT COUNT(*) AS count 
                             FROM Products 
                             WHERE store_id = ? AND CreationDate >= ?`;
                itemsParams = [storeId, formatDateTime(startOfMonth)];
            } else {
                // Fallback: Products table without store_id (legacy)
                itemsQuery = `SELECT COUNT(*) AS count 
                             FROM Products 
                             WHERE CreationDate >= ?`;
                itemsParams = [formatDateTime(startOfMonth)];
            }
            
            [itemsAddedThisMonth] = await query(itemsQuery, itemsParams);
        } catch (error) {
            console.warn('Dashboard items added this month query skipped:', error?.message || error);
        }

        try {
            // Use Products table with store_inventory table for low stock items
            // Check if store_inventory table exists
            const storeInventoryCheck = await query(`
                SELECT TABLE_NAME 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'store_inventory'
            `);
            
            if (storeInventoryCheck.length > 0) {
                lowStockItems = await query(
                    `SELECT 
                        p.ProductCode AS id,
                        p.ProductName AS name,
                        p.ProductCode AS itemCode,
                        si.qty_on_hand AS quantity,
                        COALESCE(p.MinimumStockLevel, p.ReorderLevel, 0) AS threshold
                     FROM Products p
                     INNER JOIN store_inventory si ON si.product_code = p.ProductCode
                     WHERE si.store_id = ? 
                       AND si.qty_on_hand <= COALESCE(p.MinimumStockLevel, p.ReorderLevel, 0)
                       AND COALESCE(p.MinimumStockLevel, p.ReorderLevel, 0) > 0
                     ORDER BY si.qty_on_hand ASC
                     LIMIT 10`,
                    [storeId]
                );
            }
        } catch (error) {
            if (error.code !== 'ER_NO_SUCH_TABLE' && error.code !== 'ER_BAD_TABLE_ERROR') {
                console.warn('Dashboard low stock query skipped:', error?.message || error);
            }
        }

        // Items/suppliers metrics handled via dedicated endpoints; skip related queries here.

        const todaySalesValue = Number(todaySales?.totalSales || 0);
        const yesterdaySalesValue = Number(yesterdaySales?.totalSales || 0);
        const lastWeekSalesValue = Number(lastWeekSales?.totalSales || 0);
        const totalSalesValue = Number(salesTotals?.totalSales || 0);

        const salesTrend = lastWeekSalesValue > 0
            ? (((totalSalesValue - lastWeekSalesValue) / lastWeekSalesValue) * 100)
            : 0;
        const dailyTrend = yesterdaySalesValue > 0
            ? (((todaySalesValue - yesterdaySalesValue) / yesterdaySalesValue) * 100)
            : 0;

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(startOfDay);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().slice(0, 10);
            const record = weeklySales.find((row) => {
                if (row?.saleDate instanceof Date) {
                    return row.saleDate.toISOString().slice(0, 10) === dateStr;
                }
                return row?.saleDate === dateStr;
            });
            chartData.push({
                name: dayNames[date.getDay()],
                sales: Number(record?.totalSales || 0)
            });
        }

        res.json({
            success: true,
            data: {
                metrics: {
                    totalSales: totalSalesValue,
                    dailyRevenue: todaySalesValue,
                    totalCustomers: Number(totalCustomers?.totalCustomers || 0),
                    todayBills: Number(todaySales?.totalBills || 0)
                },
                trends: {
                    salesTrend: Number.isFinite(salesTrend) ? Number(salesTrend.toFixed(1)) : 0,
                    dailyTrend: Number.isFinite(dailyTrend) ? Number(dailyTrend.toFixed(1)) : 0,
                    newCustomersToday: Number(newCustomersToday?.newCustomers || 0),
                    itemsAddedThisMonth: Number(itemsAddedThisMonth?.count || 0)
                },
                charts: {
                    weeklySales: chartData,
                    categorySales: [{ name: 'All Sales', value: totalSalesValue }]
                },
                lowStockItems: lowStockItems.map((item) => ({
                    name: item.name,
                    sku: item.itemCode,
                    quantity: Number(item.quantity || 0),
                    threshold: Number(item.threshold || 0)
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const getTotalSuppliersCount = async (req, res) => {
    try {
        const storeId = await getSelectedStoreId(req.user);
        if (!storeId) {
            return res.status(400).json({
                success: false,
                message: 'Please select a store before viewing supplier counts.'
            });
        }
        
        console.log(`[Dashboard] getTotalSuppliersCount called for storeId: ${storeId}`);
        const totalSuppliers = await fetchTotalSuppliers(storeId);
        console.log(`[Dashboard] getTotalSuppliersCount result:`, totalSuppliers);
        
        res.json({
            success: true,
            data: totalSuppliers
        });
    } catch (error) {
        console.error('[Dashboard] Error in getTotalSuppliersCount:', error);
        console.error('[Dashboard] Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch supplier count',
            error: error.message
        });
    }
};

export const getStoreItemsCount = async (req, res) => {
    try {
        const storeId = await getSelectedStoreId(req.user);
        if (!storeId) {
            return res.status(400).json({
                success: false,
                message: 'Please select a store before viewing item counts.'
            });
        }

        // Check if Products table has store_id column
        let hasStoreIdColumn = false;
        try {
            const storeIdColumnCheck = await query(`
                SELECT COLUMN_NAME 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'Products'
                AND COLUMN_NAME = 'store_id'
            `);
            hasStoreIdColumn = storeIdColumnCheck.length > 0;
        } catch (error) {
            console.warn('Error checking for store_id column in Products table:', error);
        }

        let sql = '';
        let params = [];

        if (hasStoreIdColumn) {
            // Filter by store_id if column exists
            sql = 'SELECT COUNT(*) AS totalItems FROM Super_Market.Products WHERE store_id = ?';
            params = [storeId];
        } else {
            // Fallback: count all products if store_id column doesn't exist (legacy)
            sql = 'SELECT COUNT(*) AS totalItems FROM Super_Market.Products';
        }

        const [result] = await query(sql, params);

        res.json({
            success: true,
            data: {
                totalItems: Number(result?.totalItems || 0)
            }
        });
    } catch (error) {
        console.error('Error fetching store items count:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch store items count'
        });
    }
};

