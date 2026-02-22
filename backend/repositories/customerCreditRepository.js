import { query, transaction } from '../db/index.js';

let ensureTablesPromise;

const ensureTables = async () => {
  if (ensureTablesPromise) {
    return ensureTablesPromise;
  }

  ensureTablesPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS customer_credit_meta (
        bill_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
        initial_amount DECIMAL(12, 2) NOT NULL,
        sgst_rate_global DECIMAL(5,2) NULL,
        cgst_rate_global DECIMAL(5,2) NULL,
        notes TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Ensure new columns exist on older databases
    try {
      const columns = await query(
        `SELECT COLUMN_NAME 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'customer_credit_meta'`
      );
      const have = new Set(columns.map((c) => c.COLUMN_NAME));
      if (!have.has('sgst_rate_global')) {
        await query(`ALTER TABLE customer_credit_meta ADD COLUMN sgst_rate_global DECIMAL(5,2) NULL AFTER initial_amount`);
      }
      if (!have.has('cgst_rate_global')) {
        await query(`ALTER TABLE customer_credit_meta ADD COLUMN cgst_rate_global DECIMAL(5,2) NULL AFTER sgst_rate_global`);
      }
      if (!have.has('notes')) {
        await query(`ALTER TABLE customer_credit_meta ADD COLUMN notes TEXT NULL AFTER cgst_rate_global`);
      }
      if (!have.has('is_hidden')) {
        await query(`ALTER TABLE customer_credit_meta ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0 AFTER notes`);
      }
    } catch (e) {
      console.warn('Failed to migrate customer_credit_meta columns:', e?.message || e);
      // continue; non-fatal
    }

    await query(`
      CREATE TABLE IF NOT EXISTS customer_credit_amount_history (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        bill_id BIGINT UNSIGNED NOT NULL,
        previous_amount DECIMAL(12, 2) NOT NULL,
        updated_amount DECIMAL(12, 2) NOT NULL,
        notes TEXT NULL,
        changed_by VARCHAR(100) NULL,
        change_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_credit_amount_bill (bill_id),
        CONSTRAINT fk_credit_amount_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS customer_credit_payments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        bill_id BIGINT UNSIGNED NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        payment_mode ENUM('cash','card','upi','credit','online','other') NOT NULL DEFAULT 'cash',
        notes TEXT NULL,
        collected_by VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_credit_payment_bill (bill_id),
        CONSTRAINT fk_credit_payment_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add payment_mode column if it doesn't exist (for existing tables)
    try {
      const columns = await query(
        `SELECT COLUMN_NAME 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'customer_credit_payments'
           AND COLUMN_NAME = 'payment_mode'`
      );
      if (!columns || columns.length === 0) {
        await query(`
          ALTER TABLE customer_credit_payments 
          ADD COLUMN payment_mode ENUM('cash','card','upi','credit','online','other') NOT NULL DEFAULT 'cash' 
          AFTER payment_date
        `);
        // Update existing records to have 'cash' as default payment mode
        await query(`
          UPDATE customer_credit_payments 
          SET payment_mode = 'cash' 
          WHERE payment_mode IS NULL OR payment_mode = ''
        `);
      } else {
        // Ensure existing NULL values are set to 'cash'
        await query(`
          UPDATE customer_credit_payments 
          SET payment_mode = 'cash' 
          WHERE payment_mode IS NULL OR payment_mode = ''
        `);
      }
    } catch (e) {
      console.warn('Failed to add/update payment_mode column to customer_credit_payments:', e?.message || e);
    }

    // Item override table for edited HSN/GST/Qty/Rate per bill line
    await query(`
      CREATE TABLE IF NOT EXISTS customer_credit_item_overrides (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        bill_id BIGINT UNSIGNED NOT NULL,
        line_no INT UNSIGNED NOT NULL,
        item_name VARCHAR(200) NULL,
        hsn_code VARCHAR(50) NULL,
        quantity DECIMAL(12,2) NULL,
        unit_price DECIMAL(12,2) NULL,
        discount DECIMAL(12,2) NULL,
        tax_rate DECIMAL(5,2) NULL,
        sgst_rate DECIMAL(5,2) NULL,
        cgst_rate DECIMAL(5,2) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_override_bill (bill_id),
        CONSTRAINT fk_override_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  })().catch((error) => {
    ensureTablesPromise = undefined;
    throw error;
  });

  return ensureTablesPromise;
};

const buildInClause = (ids = []) => {
  const unique = [...new Set(ids.map((id) => Number.parseInt(id, 10)))].filter((id) =>
    Number.isFinite(id)
  );

  if (unique.length === 0) {
    return null;
  }

  const placeholders = unique.map(() => '?').join(', ');
  return {
    clause: placeholders,
    params: unique,
  };
};

export const getCreditMetaForBills = async (billIds = []) => {
  await ensureTables();
  const inClause = buildInClause(billIds);
  const map = new Map();

  if (!inClause) {
    return map;
  }

  const rows = await query(
    `SELECT bill_id, initial_amount, sgst_rate_global, cgst_rate_global, notes, is_hidden
     FROM customer_credit_meta
     WHERE bill_id IN (${inClause.clause})`,
    inClause.params
  );

  rows.forEach((row) => {
    map.set(String(row.bill_id), {
      initialAmount: Number(row.initial_amount),
      sgstRateGlobal: row.sgst_rate_global !== null ? Number(row.sgst_rate_global) : null,
      cgstRateGlobal: row.cgst_rate_global !== null ? Number(row.cgst_rate_global) : null,
      notes: row.notes || null,
      isHidden: row.is_hidden === 1 || row.is_hidden === true
    });
  });

  return map;
};

export const getAmountHistoryForBills = async (billIds = []) => {
  await ensureTables();
  const inClause = buildInClause(billIds);
  const map = new Map();

  if (!inClause) {
    return map;
  }

  const rows = await query(
    `SELECT bill_id, previous_amount, updated_amount, notes, changed_by, change_date
     FROM customer_credit_amount_history
     WHERE bill_id IN (${inClause.clause})
     ORDER BY change_date ASC, id ASC`,
    inClause.params
  );

  rows.forEach((row) => {
    const billId = String(row.bill_id);
    if (!map.has(billId)) {
      map.set(billId, []);
    }
    const changedBy = (() => {
      const raw = row.changed_by ? String(row.changed_by).trim() : '';
      if (!raw) return null;
      const parts = raw.split(/\s+/);
      const firstName = parts.shift() ?? '';
      const lastName = parts.join(' ');
      return {
        firstName,
        lastName,
        fullName: raw,
      };
    })();

    map.get(billId).push({
      previousAmount: Number(row.previous_amount ?? 0),
      updatedAmount: Number(row.updated_amount ?? 0),
      notes: row.notes ?? '',
      changedBy,
      changeDate: row.change_date,
    });
  });

  return map;
};

export const getPaymentHistoryForBills = async (billIds = []) => {
  await ensureTables();
  const inClause = buildInClause(billIds);
  const map = new Map();

  if (!inClause) {
    return map;
  }

  const rows = await query(
    `SELECT bill_id, amount, payment_date, payment_mode, notes, collected_by
     FROM customer_credit_payments
     WHERE bill_id IN (${inClause.clause})
     ORDER BY payment_date ASC, id ASC`,
    inClause.params
  );

  rows.forEach((row) => {
    const billId = String(row.bill_id);
    if (!map.has(billId)) {
      map.set(billId, { history: [], totalPaid: 0 });
    }
    const collectedBy = (() => {
      const raw = row.collected_by ? String(row.collected_by).trim() : '';
      if (!raw) return null;
      const parts = raw.split(/\s+/);
      const firstName = parts.shift() ?? '';
      const lastName = parts.join(' ');
      return {
        firstName,
        lastName,
        fullName: raw,
      };
    })();

    const entry = {
      amount: Number(row.amount ?? 0),
      paymentDate: row.payment_date,
      paymentMode: row.payment_mode || 'cash',
      notes: row.notes ?? '',
      collectedBy,
    };
    const bucket = map.get(billId);
    bucket.history.push(entry);
    bucket.totalPaid += entry.amount;
  });

  return map;
};

export const ensureCreditMeta = async (billId, initialAmount) => {
  await ensureTables();

  await query(
    `INSERT INTO customer_credit_meta (bill_id, initial_amount)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE initial_amount = initial_amount`,
    [billId, initialAmount]
  );
};

export const updateCreditMetaExtras = async (billId, { sgstRateGlobal = null, cgstRateGlobal = null, notes = null } = {}) => {
  await ensureTables();
  await query(
    `UPDATE customer_credit_meta
     SET 
       sgst_rate_global = COALESCE(?, sgst_rate_global),
       cgst_rate_global = COALESCE(?, cgst_rate_global),
       notes = COALESCE(?, notes),
       updated_at = NOW()
     WHERE bill_id = ?`,
    [sgstRateGlobal, cgstRateGlobal, notes, billId]
  );
};

export const toggleCreditVisibility = async (billId, isHidden) => {
  await ensureTables();
  // Ensure meta exists first
  await ensureCreditMeta(billId, 0);
  await query(
    `UPDATE customer_credit_meta
     SET is_hidden = ?, updated_at = NOW()
     WHERE bill_id = ?`,
    [isHidden ? 1 : 0, billId]
  );
};

export const getItemOverridesForBill = async (billId) => {
  await ensureTables();
  const rows = await query(
    `SELECT line_no, item_name, hsn_code, quantity, unit_price, discount, tax_rate, sgst_rate, cgst_rate
     FROM customer_credit_item_overrides
     WHERE bill_id = ?
     ORDER BY line_no ASC`,
    [billId]
  );
  
  const overridesMap = new Map();
  rows.forEach((row) => {
    overridesMap.set(Number(row.line_no), {
      itemName: row.item_name,
      hsnCode: row.hsn_code,
      quantity: row.quantity !== null ? Number(row.quantity) : null,
      unitPrice: row.unit_price !== null ? Number(row.unit_price) : null,
      discount: row.discount !== null ? Number(row.discount) : null,
      taxRate: row.tax_rate !== null ? Number(row.tax_rate) : null,
      sgstRate: row.sgst_rate !== null ? Number(row.sgst_rate) : null,
      cgstRate: row.cgst_rate !== null ? Number(row.cgst_rate) : null,
    });
  });
  
  return overridesMap;
};

export const replaceItemOverrides = async (billId, items = []) => {
  await ensureTables();
  await transaction(async (conn) => {
    await conn.query(`DELETE FROM customer_credit_item_overrides WHERE bill_id = ?`, [billId]);
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }
    const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = items.flatMap((it, idx) => [
      billId,
      Number.isFinite(Number(it.lineNo)) ? Number(it.lineNo) : idx + 1,
      it.itemName ?? null,
      it.hsnCode ?? null,
      Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : null,
      Number.isFinite(Number(it.unitPrice)) ? Number(it.unitPrice) : null,
      Number.isFinite(Number(it.discount)) ? Number(it.discount) : null,
      Number.isFinite(Number(it.taxRate)) ? Number(it.taxRate) : null,
      Number.isFinite(Number(it.sgstRate)) ? Number(it.sgstRate) : null,
      Number.isFinite(Number(it.cgstRate)) ? Number(it.cgstRate) : null,
    ]);
    await conn.query(
      `INSERT INTO customer_credit_item_overrides (
        bill_id, line_no, item_name, hsn_code, quantity, unit_price, discount, tax_rate, sgst_rate, cgst_rate
      ) VALUES ${placeholders}`,
      values
    );
  });
};

export const recordCreditAmountChange = async (
  billId,
  previousAmount,
  newAmount,
  notes,
  changedBy
) => {
  await ensureTables();

  await query(
    `INSERT INTO customer_credit_amount_history (
      bill_id,
      previous_amount,
      updated_amount,
      notes,
      changed_by
    ) VALUES (?, ?, ?, ?, ?)`,
    [billId, previousAmount, newAmount, notes || null, changedBy || null]
  );
};

export const updateBillAmounts = async (billId, newAmount) => {
  await ensureTables();
  await query(
    `UPDATE bills
     SET subtotal = ?, total = ?, updated_at = NOW()
     WHERE id = ?`,
    [newAmount, newAmount, billId]
  );
};

export const recordCreditPayment = async (billId, amount, notes, collectedBy, paymentMode = 'cash') => {
  await ensureTables();
  
  // Validate payment mode
  const validModes = ['cash', 'card', 'upi', 'credit', 'online', 'other'];
  const normalizedPaymentMode = validModes.includes(paymentMode) ? paymentMode : 'cash';
  
  await query(
    `INSERT INTO customer_credit_payments (
      bill_id,
      amount,
      payment_mode,
      notes,
      collected_by
    ) VALUES (?, ?, ?, ?, ?)`,
    [billId, amount, normalizedPaymentMode, notes || null, collectedBy || null]
  );
};

export const getTotalPaidForBill = async (billId) => {
  await ensureTables();
  const rows = await query(
    `SELECT COALESCE(SUM(amount), 0) AS totalPaid
     FROM customer_credit_payments
     WHERE bill_id = ?`,
    [billId]
  );

  return Number(rows?.[0]?.totalPaid ?? 0);
};

export const updateBillPaymentStatus = async (billId, status) => {
  await ensureTables();
  const normalizedStatus = ['pending', 'partial', 'paid', 'refunded'].includes(status)
    ? status
    : 'pending';

  await query(
    `UPDATE bills
     SET payment_status = ?, updated_at = NOW()
     WHERE id = ?`,
    [normalizedStatus, billId]
  );
};

export const getCustomerCreditDetails = async (billIds = []) => {
  await ensureTables();

  const [metaMap, amountHistoryMap, paymentHistoryMap] = await Promise.all([
    getCreditMetaForBills(billIds),
    getAmountHistoryForBills(billIds),
    getPaymentHistoryForBills(billIds),
  ]);

  return {
    metaMap,
    amountHistoryMap,
    paymentHistoryMap,
  };
};

