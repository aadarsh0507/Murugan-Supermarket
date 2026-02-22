import { body, param, validationResult } from 'express-validator';
import {
  createBill as createBillRepo,
  deleteBill as deleteBillRepo,
  getBillById as getBillByIdRepo,
  getBillByBillNo as getBillByBillNoRepo,
  findLatestCustomerByPhone as findLatestCustomerByPhoneRepo,
  listBills as listBillsRepo
} from '../repositories/billRepository.js';
import {
  upsertCustomerByPhone as upsertCustomerRepo,
  getCustomerByPhone as getCustomerMasterByPhoneRepo
} from '../repositories/customerRepository.js';

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

export const createBillValidation = [
  body('storeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('storeId must be a positive integer'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required to create a bill'),
  body('items.*.name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Each item must include a name up to 200 characters'),
  body('items.*.itemName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Each itemName must be between 1 and 200 characters'),
  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Item quantity must be a positive integer'),
  body('items.*.unitPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Item unitPrice must be a non-negative number'),
  body('items.*.price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Item price must be a non-negative number'),
  body('items.*.discount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Item discount must be a non-negative number'),
  body('items.*.taxRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Item taxRate must be a non-negative number'),
  body('items.*.itemId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('itemId must be a positive integer when provided'),
  body('billNo')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('billNo must be between 2 and 50 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('date must be a valid ISO8601 string'),
  body('customerName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('customerName cannot exceed 100 characters'),
  body('customerPhone')
    .optional({ checkFalsy: true })
    .matches(/^[\+]?[0-9]{6,20}$/)
    .withMessage('customerPhone must be a valid phone number'),
  body('customerEmail')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('customerEmail must be a valid email')
    .normalizeEmail(),
  body('customerAddress')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage('customerAddress cannot exceed 255 characters'),
  body('customerGstin')
    .optional({ checkFalsy: true })
    .matches(/^[0-9A-Z]{15}$/i)
    .withMessage('customerGstin must be 15 characters (GSTIN)'),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'upi', 'credit', 'online', 'other'])
    .withMessage('Invalid payment method'),
  body('transactionId')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('transactionId cannot exceed 100 characters'),
  body('paymentStatus')
    .optional()
    .isIn(['pending', 'partial', 'paid', 'refunded'])
    .withMessage('Invalid payment status'),
  body('subtotal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('subtotal must be a non-negative number'),
  body('tax')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('tax must be a non-negative number'),
  body('discount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('discount must be a non-negative number'),
  body('total')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('total must be a non-negative number')
];

export const billIdParamValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Bill id must be a positive integer')
];

export const billNumberParamValidation = [
  param('billNo')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Bill number must be between 2 and 50 characters')
];

export const customerPhoneParamValidation = [
  param('phone')
    .trim()
    .matches(/^[\+]?[0-9]{6,20}$/)
    .withMessage('Customer phone must be a valid phone number')
];

const handleDatabaseError = (error, res) => {
  if (error?.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({
      status: 'error',
      message: 'Bills table is missing. Please run the latest database migrations.'
    });
  }

  if (error?.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      status: 'error',
      message: 'The provided store or user reference does not exist.'
    });
  }

  return res.status(500).json({
    status: 'error',
    message: 'Server error while processing bill request'
  });
};

export const getBills = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      startDate,
      endDate,
      createdBy,
      storeId,
      paymentMethod,
      paymentStatus,
    } = req.query;

    // Get store ID from query param or user's selected store
    const resolvedStoreId = Number(storeId) || 
      Number(req.user?.selectedStore?.id) || 
      Number(req.user?.selectedStore?._id) ||
      Number(req.user?.selectedStoreId) ||
      null;

    const filters = {
      page,
      limit,
      search,
      startDate,
      endDate,
      storeId: resolvedStoreId,
      paymentMethod,
      paymentStatus,
    };

    if (createdBy) {
      filters.userId = createdBy;
    }

    const { bills, pagination } = await listBillsRepo(filters);

    res.json({
      status: 'success',
      data: bills,
      pagination,
    });
  } catch (error) {
    console.error('List bills error:', error);
    handleDatabaseError(error, res);
  }
};

export const createBill = async (req, res) => {
  try {
    if (respondValidationErrors(req, res)) return;

    const {
      billNo,
      storeId,
      date,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerGstin,
      paymentMethod,
      paymentStatus,
      transactionId,
      subtotal,
      tax,
      discount,
      total,
      items
    } = req.body;

    const resolvedStoreId = Number(storeId || req.user?.selectedStore?.id);
    if (!resolvedStoreId) {
      return res.status(400).json({
        status: 'error',
        message: 'A store must be selected before creating a bill.'
      });
    }

    const payload = {
      billNo: billNo?.trim(),
      storeId: resolvedStoreId,
      userId: req.user?.id ?? req.user?._id ?? null,
      date: date ? new Date(date) : new Date(),
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerGstin,
      paymentMethod,
      paymentStatus,
      transactionId,
      subtotal,
      tax,
      discount,
      total,
      items
    };

    const trimmedCustomerName =
      payload.customerName !== undefined && payload.customerName !== null
        ? String(payload.customerName).trim()
        : '';
    const trimmedCustomerPhone =
      payload.customerPhone !== undefined && payload.customerPhone !== null
        ? String(payload.customerPhone).trim()
        : '';
    const trimmedCustomerEmail =
      payload.customerEmail !== undefined && payload.customerEmail !== null
        ? String(payload.customerEmail).trim()
        : '';
    const trimmedCustomerAddress =
      payload.customerAddress !== undefined && payload.customerAddress !== null
        ? String(payload.customerAddress).trim()
        : '';
    const trimmedCustomerGstin =
      payload.customerGstin !== undefined && payload.customerGstin !== null
        ? String(payload.customerGstin).trim().toUpperCase()
        : '';

    payload.customerName = trimmedCustomerName || null;
    payload.customerPhone = trimmedCustomerPhone || null;
    payload.customerEmail = trimmedCustomerEmail || null;
    payload.customerAddress = trimmedCustomerAddress || null;
    payload.customerGstin = trimmedCustomerGstin || null;
    payload.transactionId = transactionId?.trim() || null;

    if (payload.paymentMethod === 'online') {
      if (!payload.transactionId || payload.transactionId.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Transaction ID is required for online payments.'
        });
      }
    }

    if (payload.paymentMethod === 'credit') {
      if (!payload.customerPhone || !/^[\+]?[0-9]{6,20}$/.test(payload.customerPhone)) {
        return res.status(400).json({
          status: 'error',
          message: 'A valid customer phone number is required for credit payments.'
        });
      }

      if (!payload.customerName || payload.customerName.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Customer name is required for credit payments.'
        });
      }

      payload.paymentStatus = 'pending';
      payload.customerId = payload.customerId ?? payload.customerPhone;
    } else {
      payload.paymentStatus = payload.paymentStatus || 'paid';
    }

    const bill = await createBillRepo(payload);

    // Upsert customer master record (non-blocking best-effort)
    try {
      if (payload.customerPhone) {
        await upsertCustomerRepo({
          storeId: resolvedStoreId || null,
          name: payload.customerName || null,
          phone: payload.customerPhone,
          email: payload.customerEmail || null,
          address: payload.customerAddress || null,
          gstin: payload.customerGstin || null,
          lastPurchaseAt: bill?.date || new Date()
        });
      }
    } catch (e) {
      console.warn('Customer upsert failed (non-fatal):', e?.message || e);
    }

    res.status(201).json({
      status: 'success',
      message: 'Bill created successfully',
      data: { bill }
    });
  } catch (error) {
    console.error('Create bill error:', error);
    handleDatabaseError(error, res);
  }
};

export const deleteBill = async (req, res) => {
  try {
    if (respondValidationErrors(req, res)) return;

    const billId = Number(req.params.id);
    const deleted = await deleteBillRepo(billId);

    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Bill not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Bill deleted successfully'
    });
  } catch (error) {
    console.error('Delete bill error:', error);
    handleDatabaseError(error, res);
  }
};

export const getBill = async (req, res) => {
  try {
    if (respondValidationErrors(req, res)) return;

    const billId = Number(req.params.id);
    const includeItems = req.query.includeItems !== 'false';

    const bill = await getBillByIdRepo(billId, { includeItems });
    if (!bill) {
      return res.status(404).json({
        status: 'error',
        message: 'Bill not found'
      });
    }

    res.json({
      status: 'success',
      data: { bill }
    });
  } catch (error) {
    console.error('Get bill error:', error);
    handleDatabaseError(error, res);
  }
};

export const getBillByNumber = async (req, res) => {
  try {
    if (respondValidationErrors(req, res)) return;

    const billNo = req.params.billNo;
    const includeItems = req.query.includeItems !== 'false';

    const bill = await getBillByBillNoRepo(billNo, { includeItems });
    if (!bill) {
      return res.status(404).json({
        status: 'error',
        message: 'Bill not found'
      });
    }

    res.json({
      status: 'success',
      data: { bill }
    });
  } catch (error) {
    console.error('Get bill by number error:', error);
    handleDatabaseError(error, res);
  }
};

export const getCustomerByPhone = async (req, res) => {
  try {
    if (respondValidationErrors(req, res)) return;

    const phone = req.params.phone?.trim();
    if (!phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Customer phone is required.'
      });
    }

    // Fetch customer regardless of store - customers are shared across stores
    // Prefer master customers table, fall back to last bill if not present
    let customer = await getCustomerMasterByPhoneRepo(phone, null);
    if (!customer) {
      customer = await findLatestCustomerByPhoneRepo(phone, null);
    }
    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found'
      });
    }

    res.json({
      status: 'success',
      data: { customer }
    });
  } catch (error) {
    console.error('Get customer by phone error:', error);
    handleDatabaseError(error, res);
  }
};
// Temporarily commented out to isolate login and register modules.
// Original implementation preserved below for future reactivation.

// // const respondNotImplemented = (res, feature) => {
// //   res.status(501).json({
// //     success: false,
// //     message: `${feature} is not yet implemented for the MySQL backend.`
// //   });
// // };
//
// // export const createBill = (req, res) => respondNotImplemented(res, 'Bill creation');
// // export const getAllBills = (req, res) => respondNotImplemented(res, 'Listing bills');
// // export const getBillById = (req, res) => respondNotImplemented(res, 'Fetching bill details');
// // export const getDailySalesSummary = (req, res) => respondNotImplemented(res, 'Daily sales summary');
// // export const getLowStockItems = (req, res) => respondNotImplemented(res, 'Low stock report');
// // export const getNoMovementItems = (req, res) => respondNotImplemented(res, 'No movement report');
//
