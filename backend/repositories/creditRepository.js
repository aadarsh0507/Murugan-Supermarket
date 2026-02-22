import { query, transaction } from '../db/index.js';

let ensureTablesPromise;

const ensureTables = async () => {
  if (ensureTablesPromise) {
    return ensureTablesPromise;
  }

  ensureTablesPromise = (async () => {
    // Create po_credits table
    await query(`
      CREATE TABLE IF NOT EXISTS po_credits (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        purchase_order_id BIGINT UNSIGNED NOT NULL,
        po_number VARCHAR(50) NOT NULL,
        supplier_id VARCHAR(100) NULL,
        supplier_name VARCHAR(255) NULL,
        store_id VARCHAR(100) NULL,
        order_date DATETIME NOT NULL,
        original_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        initial_original_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        balance_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        status ENUM('pending','partially_paid','paid') NOT NULL DEFAULT 'pending',
        notes TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_po_credit (purchase_order_id),
        KEY idx_po_credits_po (purchase_order_id),
        KEY idx_po_credits_po_number (po_number),
        KEY idx_po_credits_supplier (supplier_id),
        KEY idx_po_credits_store (store_id),
        KEY idx_po_credits_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create po_credit_payments table for payment history
    await query(`
      CREATE TABLE IF NOT EXISTS po_credit_payments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        po_credit_id BIGINT UNSIGNED NOT NULL,
        payment_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        payment_date DATETIME NOT NULL,
        payment_mode ENUM('cash','card','upi','credit','online','other') NOT NULL DEFAULT 'cash',
        notes TEXT NULL,
        collected_by_first_name VARCHAR(100) NULL,
        collected_by_last_name VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_po_credit_payments_credit (po_credit_id),
        CONSTRAINT fk_po_credit_payments_credit FOREIGN KEY (po_credit_id) REFERENCES po_credits(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add payment_mode column if it doesn't exist (for existing tables)
    try {
      const columns = await query(
        `SELECT COLUMN_NAME 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'po_credit_payments'
           AND COLUMN_NAME = 'payment_mode'`
      );
      if (!columns || columns.length === 0) {
        await query(`
          ALTER TABLE po_credit_payments 
          ADD COLUMN payment_mode ENUM('cash','card','upi','credit','online','other') NOT NULL DEFAULT 'cash' 
          AFTER payment_date
        `);
        // Update existing records to have 'cash' as default payment mode
        await query(`
          UPDATE po_credit_payments 
          SET payment_mode = 'cash' 
          WHERE payment_mode IS NULL OR payment_mode = ''
        `);
      } else {
        // Ensure existing NULL values are set to 'cash'
        await query(`
          UPDATE po_credit_payments 
          SET payment_mode = 'cash' 
          WHERE payment_mode IS NULL OR payment_mode = ''
        `);
      }
    } catch (e) {
      console.warn('Failed to add/update payment_mode column to po_credit_payments:', e?.message || e);
    }

    // Create po_credit_amount_changes table for amount change history
    await query(`
      CREATE TABLE IF NOT EXISTS po_credit_amount_changes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        po_credit_id BIGINT UNSIGNED NOT NULL,
        previous_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        updated_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
        change_date DATETIME NOT NULL,
        notes TEXT NULL,
        changed_by_first_name VARCHAR(100) NULL,
        changed_by_last_name VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_po_credit_amount_changes_credit (po_credit_id),
        CONSTRAINT fk_po_credit_amount_changes_credit FOREIGN KEY (po_credit_id) REFERENCES po_credits(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  })().catch((error) => {
    ensureTablesPromise = undefined;
    throw error;
  });

  return ensureTablesPromise;
};

const mapCreditRow = (row) => {
  if (!row) return null;
  // Use supplier data from joined Suppliers table if available, otherwise fall back to stored values
  const supplierId = row.supplier_SUPPLIERCODE || row.supplier_id;
  const supplierName = row.supplier_Suppliername || row.supplier_name;
  
  // Debug logging (can be removed later)
  if (row.supplier_id && !row.supplier_Suppliername) {
    console.log(`[CreditRepository] Supplier ID ${row.supplier_id} not found in Suppliers table for credit ${row.id}`);
  }
  
  return {
    _id: String(row.id),
    purchaseOrderId: String(row.purchase_order_id),
    poNumber: row.po_number,
    supplierId: supplierId,
    supplierName: supplierName,
    supplier: (supplierId || supplierName) ? {
      _id: String(supplierId || row.supplier_id || ''),
      companyName: supplierName || row.supplier_name || '',
    } : null,
    storeId: row.store_id,
    orderDate: row.order_date,
    originalAmount: Number(row.original_amount ?? 0),
    initialOriginalAmount: Number(row.initial_original_amount ?? 0),
    paidAmount: Number(row.paid_amount ?? 0),
    balanceAmount: Number(row.balance_amount ?? 0),
    status: row.status || 'pending',
    notes: row.notes,
    purchaseOrder: {
      poNumber: row.po_number,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const calculateStatus = (originalAmount, paidAmount) => {
  const balance = originalAmount - paidAmount;
  if (balance <= 0) return 'paid';
  if (paidAmount > 0 && balance > 0) return 'partially_paid';
  return 'pending';
};

const recalcCreditAmounts = (credit) => {
  const original = Number(credit.originalAmount ?? 0);
  const paid = Number(credit.paidAmount ?? 0);
  const balance = Math.max(original - paid, 0);
  const status = calculateStatus(original, paid);
  return { originalAmount: original, paidAmount: paid, balanceAmount: balance, status };
};

export const createCredit = async ({
  purchaseOrderId,
  poNumber,
  supplierId,
  supplierName,
  storeId,
  orderDate,
  originalAmount = 0,
  initialPayment = 0,
  notes = '',
}) => {
  // Ensure tables exist before starting transaction
  try {
    await ensureTables();
  } catch (error) {
    console.error('Error ensuring tables exist:', error);
    // Continue anyway - table creation might have failed but table might already exist
  }

  return transaction(async (connection) => {
    // Ensure tables exist within transaction (in case they weren't created before)
    try {
      // Create po_credits table first
      await connection.query(`
        CREATE TABLE IF NOT EXISTS po_credits (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          purchase_order_id BIGINT UNSIGNED NOT NULL,
          po_number VARCHAR(50) NOT NULL,
          supplier_id VARCHAR(100) NULL,
          supplier_name VARCHAR(255) NULL,
          store_id VARCHAR(100) NULL,
          order_date DATETIME NOT NULL,
          original_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          initial_original_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          balance_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          status ENUM('pending','partially_paid','paid') NOT NULL DEFAULT 'pending',
          notes TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_po_credit (purchase_order_id),
          KEY idx_po_credits_po (purchase_order_id),
          KEY idx_po_credits_po_number (po_number),
          KEY idx_po_credits_supplier (supplier_id),
          KEY idx_po_credits_store (store_id),
          KEY idx_po_credits_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Create po_credit_payments table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS po_credit_payments (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          po_credit_id BIGINT UNSIGNED NOT NULL,
          payment_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          payment_date DATETIME NOT NULL,
          payment_mode ENUM('cash','card','upi','credit','online','other') NOT NULL DEFAULT 'cash',
          notes TEXT NULL,
          collected_by_first_name VARCHAR(100) NULL,
          collected_by_last_name VARCHAR(100) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_po_credit_payments_credit (po_credit_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Create po_credit_amount_changes table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS po_credit_amount_changes (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          po_credit_id BIGINT UNSIGNED NOT NULL,
          previous_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          updated_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          change_date DATETIME NOT NULL,
          notes TEXT NULL,
          changed_by_first_name VARCHAR(100) NULL,
          changed_by_last_name VARCHAR(100) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_po_credit_amount_changes_credit (po_credit_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Add foreign keys if they don't exist (ignore errors if they already exist)
      try {
        await connection.query(`
          ALTER TABLE po_credit_payments
          ADD CONSTRAINT fk_po_credit_payments_credit 
          FOREIGN KEY (po_credit_id) REFERENCES po_credits(id) ON DELETE CASCADE
        `);
      } catch (fkError) {
        // Foreign key might already exist (error code 1022, 1061, or 1062), which is fine
        const duplicateErrorCodes = ['ER_DUP_KEYNAME', 'ER_DUP_FIELDNAME', 'ER_DUP_ENTRY', 1022, 1061, 1062];
        if (!duplicateErrorCodes.includes(fkError.code) && !duplicateErrorCodes.includes(fkError.errno)) {
          console.warn('Warning adding foreign key to po_credit_payments:', fkError.message);
        }
      }

      try {
        await connection.query(`
          ALTER TABLE po_credit_amount_changes
          ADD CONSTRAINT fk_po_credit_amount_changes_credit 
          FOREIGN KEY (po_credit_id) REFERENCES po_credits(id) ON DELETE CASCADE
        `);
      } catch (fkError) {
        // Foreign key might already exist (error code 1022, 1061, or 1062), which is fine
        const duplicateErrorCodes = ['ER_DUP_KEYNAME', 'ER_DUP_FIELDNAME', 'ER_DUP_ENTRY', 1022, 1061, 1062];
        if (!duplicateErrorCodes.includes(fkError.code) && !duplicateErrorCodes.includes(fkError.errno)) {
          console.warn('Warning adding foreign key to po_credit_amount_changes:', fkError.message);
        }
      }
    } catch (tableError) {
      // Table might already exist, which is fine
      if (tableError.code !== 'ER_TABLE_EXISTS_ERROR' && tableError.code !== 'ER_DUP_KEYNAME') {
        console.warn('Warning creating po_credits tables:', tableError.message);
      }
    }

    // Check if credit already exists for this PO
    const [existing] = await connection.query(
      `SELECT id FROM po_credits WHERE purchase_order_id = ? LIMIT 1`,
      [purchaseOrderId]
    );

    if (existing && existing.length > 0) {
      throw new Error('Credit already exists for this purchase order');
    }

    const initialOriginalAmount = Number(originalAmount || 0);
    const paidAmount = Number(initialPayment || 0);
    const { balanceAmount, status } = recalcCreditAmounts({
      originalAmount: initialOriginalAmount,
      paidAmount,
    });

    const [result] = await connection.execute(
      `INSERT INTO po_credits (
        purchase_order_id,
        po_number,
        supplier_id,
        supplier_name,
        store_id,
        order_date,
        original_amount,
        initial_original_amount,
        paid_amount,
        balance_amount,
        status,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        purchaseOrderId,
        poNumber,
        supplierId || null,
        supplierName || null,
        storeId || null,
        orderDate ? new Date(orderDate) : new Date(),
        initialOriginalAmount,
        initialOriginalAmount,
        paidAmount,
        balanceAmount,
        status,
        notes || null,
      ]
    );

    const creditId = result.insertId;

    // If initial payment > 0, create payment record
    if (paidAmount > 0) {
      await connection.execute(
        `INSERT INTO po_credit_payments (
          po_credit_id,
          payment_amount,
          payment_date,
          payment_mode,
          notes,
          collected_by_first_name,
          collected_by_last_name
        ) VALUES (?, ?, NOW(), ?, ?, ?, ?)`,
        [
          creditId,
          paidAmount,
          'cash', // Default payment mode for initial payment
          notes || 'Initial payment',
          'System',
          'User',
        ]
      );
    }

    // Fetch and return the created credit with payment history
    return getCreditById(creditId);
  });
};

export const getCreditById = async (creditId) => {
  await ensureTables();

  // Join with Suppliers table to get supplier details
  // Cast supplier_id to integer to match SUPPLIERCODE (INTEGER)
  const rows = await query(
    `SELECT c.*, 
            s.SUPPLIERCODE as supplier_SUPPLIERCODE,
            s.NAME as supplier_Suppliername
     FROM po_credits c
     LEFT JOIN Suppliers s ON (
       c.supplier_id IS NOT NULL AND 
       c.supplier_id != '' AND
       CAST(c.supplier_id AS UNSIGNED) = s.SUPPLIERCODE
     )
     WHERE c.id = ? LIMIT 1`,
    [creditId]
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  const credit = mapCreditRow(rows[0]);

  // Fetch payment history
  const paymentRows = await query(
    `SELECT id, payment_amount, payment_date, payment_mode, notes, 
            collected_by_first_name, collected_by_last_name, created_at
     FROM po_credit_payments
     WHERE po_credit_id = ?
     ORDER BY payment_date DESC, id DESC`,
    [creditId]
  );

  credit.paymentHistory = paymentRows.map(row => ({
    _id: String(row.id),
    amount: Number(row.payment_amount ?? 0),
    paymentDate: row.payment_date,
    paymentMode: row.payment_mode || 'cash',
    notes: row.notes,
    collectedBy: {
      firstName: row.collected_by_first_name || '',
      lastName: row.collected_by_last_name || '',
    },
    createdAt: row.created_at,
  }));

  // Fetch amount change history
  const amountChangeRows = await query(
    `SELECT id, previous_amount, updated_amount, change_date, notes,
            changed_by_first_name, changed_by_last_name, created_at
     FROM po_credit_amount_changes
     WHERE po_credit_id = ?
     ORDER BY change_date DESC, id DESC`,
    [creditId]
  );

  credit.amountChangeHistory = amountChangeRows.map(row => ({
    _id: String(row.id),
    previousAmount: Number(row.previous_amount ?? 0),
    updatedAmount: Number(row.updated_amount ?? 0),
    changeDate: row.change_date,
    notes: row.notes,
    changedBy: {
      firstName: row.changed_by_first_name || '',
      lastName: row.changed_by_last_name || '',
    },
    createdAt: row.created_at,
  }));

  return credit;
};

export const getAllCredits = async (filters = {}) => {
  await ensureTables();

  const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 20, 1), 200);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (filters.storeId) {
    conditions.push('c.store_id = ?');
    params.push(filters.storeId);
  }

  if (filters.supplierId) {
    conditions.push('c.supplier_id = ?');
    params.push(filters.supplierId);
  }

  if (filters.status) {
    conditions.push('c.status = ?');
    params.push(filters.status);
  }

  if (filters.startDate) {
    conditions.push('DATE(c.order_date) >= ?');
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push('DATE(c.order_date) <= ?');
    params.push(filters.endDate);
  }

  if (filters.search) {
    const like = `%${filters.search.trim()}%`;
    conditions.push('(c.po_number LIKE ? OR c.supplier_name LIKE ?)');
    params.push(like, like);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const baseParams = params;

  // Join with Suppliers table to get supplier details
  // Cast supplier_id to integer to match SUPPLIERCODE (INTEGER)
  const creditRows = await query(
    `SELECT c.*, 
            s.SUPPLIERCODE as supplier_SUPPLIERCODE,
            s.NAME as supplier_Suppliername
     FROM po_credits c
     LEFT JOIN Suppliers s ON (
       c.supplier_id IS NOT NULL AND 
       c.supplier_id != '' AND
       CAST(c.supplier_id AS UNSIGNED) = s.SUPPLIERCODE
     )
     ${whereClause}
     ORDER BY c.order_date DESC, c.id DESC
     LIMIT ? OFFSET ?`,
    [...baseParams, limit, offset]
  );

  const countRows = await query(
    `SELECT COUNT(*) AS totalItems
     FROM po_credits c
     LEFT JOIN Suppliers s ON (
       c.supplier_id IS NOT NULL AND 
       c.supplier_id != '' AND
       CAST(c.supplier_id AS UNSIGNED) = s.SUPPLIERCODE
     )
     ${whereClause}`,
    baseParams
  );

  const totalItems = countRows?.[0]?.totalItems ? Number(countRows[0].totalItems) : 0;

  const credits = creditRows.map(mapCreditRow);

  // Fetch amount change history and payment history for all credits
  if (credits.length > 0) {
    const creditIds = credits.map(c => c._id);
    const placeholders = creditIds.map(() => '?').join(',');
    
    const amountChangeRows = await query(
      `SELECT po_credit_id, id, previous_amount, updated_amount, change_date, notes,
              changed_by_first_name, changed_by_last_name, created_at
       FROM po_credit_amount_changes
       WHERE po_credit_id IN (${placeholders})
       ORDER BY po_credit_id, change_date DESC, id DESC`,
      creditIds
    );

    // Fetch payment history with payment mode
    const paymentRows = await query(
      `SELECT po_credit_id, id, payment_amount, payment_date, payment_mode, notes,
              collected_by_first_name, collected_by_last_name, created_at
       FROM po_credit_payments
       WHERE po_credit_id IN (${placeholders})
       ORDER BY po_credit_id, payment_date DESC, id DESC`,
      creditIds
    );

    // Group changes by credit ID
    const changesByCreditId = {};
    amountChangeRows.forEach(row => {
      const creditId = String(row.po_credit_id);
      if (!changesByCreditId[creditId]) {
        changesByCreditId[creditId] = [];
      }
      changesByCreditId[creditId].push({
        _id: String(row.id),
        previousAmount: Number(row.previous_amount ?? 0),
        updatedAmount: Number(row.updated_amount ?? 0),
        changeDate: row.change_date,
        notes: row.notes,
        changedBy: {
          firstName: row.changed_by_first_name || '',
          lastName: row.changed_by_last_name || '',
        },
        createdAt: row.created_at,
      });
    });

    // Group payments by credit ID
    const paymentsByCreditId = {};
    paymentRows.forEach(row => {
      const creditId = String(row.po_credit_id);
      if (!paymentsByCreditId[creditId]) {
        paymentsByCreditId[creditId] = [];
      }
      paymentsByCreditId[creditId].push({
        _id: String(row.id),
        amount: Number(row.payment_amount ?? 0),
        paymentDate: row.payment_date,
        paymentMode: row.payment_mode || 'cash',
        notes: row.notes,
        collectedBy: {
          firstName: row.collected_by_first_name || '',
          lastName: row.collected_by_last_name || '',
        },
        createdAt: row.created_at,
      });
    });

    // Attach history to each credit
    credits.forEach(credit => {
      credit.amountChangeHistory = changesByCreditId[credit._id] || [];
      credit.paymentHistory = paymentsByCreditId[credit._id] || [];
    });
  }

  return {
    credits,
    pagination: {
      currentPage: page,
      itemsPerPage: limit,
      totalItems,
      totalPages: Math.max(Math.ceil(totalItems / limit), 1),
    },
  };
};

export const updateCreditAmount = async (creditId, newAmount, notes = '', changedBy = {}) => {
  await ensureTables();

  return transaction(async (connection) => {
    // Get current credit
    const [currentRows] = await connection.query(
      `SELECT original_amount FROM po_credits WHERE id = ? LIMIT 1`,
      [creditId]
    );

    if (!currentRows || currentRows.length === 0) {
      throw new Error('Credit not found');
    }

    const previousAmount = Number(currentRows[0].original_amount ?? 0);
    const updatedAmount = Number(newAmount || 0);

    if (updatedAmount <= 0) {
      throw new Error('New amount must be greater than zero');
    }

    // Update credit amount
    const { balanceAmount, status } = recalcCreditAmounts({
      originalAmount: updatedAmount,
      paidAmount: 0, // Will be recalculated from payments
    });

    // Get current paid amount
    const [paidRows] = await connection.query(
      `SELECT SUM(payment_amount) AS total_paid
       FROM po_credit_payments
       WHERE po_credit_id = ?`,
      [creditId]
    );

    const totalPaid = Number(paidRows[0]?.total_paid ?? 0);
    const finalBalance = Math.max(updatedAmount - totalPaid, 0);
    const finalStatus = calculateStatus(updatedAmount, totalPaid);

    await connection.execute(
      `UPDATE po_credits
       SET original_amount = ?,
           balance_amount = ?,
           status = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [updatedAmount, finalBalance, finalStatus, creditId]
    );

    // Record amount change
    await connection.execute(
      `INSERT INTO po_credit_amount_changes (
        po_credit_id,
        previous_amount,
        updated_amount,
        change_date,
        notes,
        changed_by_first_name,
        changed_by_last_name
      ) VALUES (?, ?, ?, NOW(), ?, ?, ?)`,
      [
        creditId,
        previousAmount,
        updatedAmount,
        notes || null,
        changedBy.firstName || 'System',
        changedBy.lastName || 'User',
      ]
    );

    return getCreditById(creditId);
  });
};

export const updateCreditPayment = async (creditId, paymentAmount, notes = '', collectedBy = {}, paymentMode = 'cash') => {
  await ensureTables();

  return transaction(async (connection) => {
    // Get current credit
    const [currentRows] = await connection.query(
      `SELECT original_amount, paid_amount FROM po_credits WHERE id = ? LIMIT 1`,
      [creditId]
    );

    if (!currentRows || currentRows.length === 0) {
      throw new Error('Credit not found');
    }

    const originalAmount = Number(currentRows[0].original_amount ?? 0);
    const currentPaid = Number(currentRows[0].paid_amount ?? 0);
    const payment = Number(paymentAmount || 0);

    if (payment <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // Validate payment mode
    const validModes = ['cash', 'card', 'upi', 'credit', 'online', 'other'];
    const normalizedPaymentMode = validModes.includes(paymentMode) ? paymentMode : 'cash';

    const newPaidAmount = currentPaid + payment;
    const { balanceAmount, status } = recalcCreditAmounts({
      originalAmount,
      paidAmount: newPaidAmount,
    });

    // Update credit
    await connection.execute(
      `UPDATE po_credits
       SET paid_amount = ?,
           balance_amount = ?,
           status = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [newPaidAmount, balanceAmount, status, creditId]
    );

    // Record payment
    await connection.execute(
      `INSERT INTO po_credit_payments (
        po_credit_id,
        payment_amount,
        payment_date,
        payment_mode,
        notes,
        collected_by_first_name,
        collected_by_last_name
      ) VALUES (?, ?, NOW(), ?, ?, ?, ?)`,
      [
        creditId,
        payment,
        normalizedPaymentMode,
        notes || null,
        collectedBy.firstName || 'System',
        collectedBy.lastName || 'User',
      ]
    );

    return getCreditById(creditId);
  });
};

export const deleteCredit = async (creditId) => {
  await ensureTables();

  const existing = await getCreditById(creditId);
  if (!existing) {
    return null;
  }

  await query(`DELETE FROM po_credits WHERE id = ?`, [creditId]);
  return existing;
};

export const getCreditsSummaryBySupplier = async (supplierId = null, storeId = null) => {
  await ensureTables();

  const conditions = [];
  const params = [];

  if (storeId) {
    conditions.push('store_id = ?');
    params.push(storeId);
  }

  if (supplierId) {
    conditions.push('supplier_id = ?');
    params.push(supplierId);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(
    `SELECT 
      COUNT(*) AS total_credits,
      SUM(original_amount) AS total_original_amount,
      SUM(paid_amount) AS total_paid_amount,
      SUM(balance_amount) AS total_balance_amount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN status = 'partially_paid' THEN 1 ELSE 0 END) AS partially_paid_count,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count
     FROM po_credits
     ${whereClause}`,
    params
  );

  const row = rows[0] || {};

  const statusBreakdown = {};
  if (row.pending_count > 0) statusBreakdown.pending = Number(row.pending_count);
  if (row.partially_paid_count > 0) statusBreakdown.partially_paid = Number(row.partially_paid_count);
  if (row.paid_count > 0) statusBreakdown.paid = Number(row.paid_count);

  return {
    supplierId: supplierId || null,
    totalCredits: Number(row.total_credits ?? 0),
    totalOriginalAmount: Number(row.total_original_amount ?? 0),
    totalPaidAmount: Number(row.total_paid_amount ?? 0),
    totalBalanceAmount: Number(row.total_balance_amount ?? 0),
    statusBreakdown,
  };
};

