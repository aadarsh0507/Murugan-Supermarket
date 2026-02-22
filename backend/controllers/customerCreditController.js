import { listBills } from '../repositories/billRepository.js';
import {
  getCustomerCreditDetails,
  ensureCreditMeta,
  recordCreditAmountChange,
  updateBillAmounts,
  recordCreditPayment,
  getTotalPaidForBill,
  updateBillPaymentStatus,
  updateCreditMetaExtras,
  replaceItemOverrides,
  getItemOverridesForBill,
  toggleCreditVisibility,
} from '../repositories/customerCreditRepository.js';

const buildPaginationMeta = (basePagination = {}) => ({
  currentPage: basePagination.currentPage ?? 1,
  totalPages: basePagination.totalPages ?? 1,
  totalItems: basePagination.totalItems ?? 0,
  itemsPerPage: basePagination.itemsPerPage ?? 20,
});

const normalizeCurrency = (value) => Number.parseFloat(value ?? 0) || 0;

const mapBillToCustomerCredit = (
  bill,
  { initialAmount, amountHistory, paymentHistory, totalPaid, creditMeta } = {}
) => {
  const totalAmount = normalizeCurrency(bill.total);
  const baseStatus = String(bill.paymentStatus || '').toLowerCase();

  // Handle both old format (number) and new format (object)
  const metaData = typeof initialAmount === 'object' && initialAmount !== null
    ? initialAmount
    : (typeof initialAmount === 'number' ? { initialAmount } : {});
  const initialOriginalAmount = normalizeCurrency(
    (metaData.initialAmount !== undefined ? metaData.initialAmount : initialAmount) || totalAmount
  );
  const isHidden = metaData.isHidden === true;

  const payments = Array.isArray(paymentHistory) ? paymentHistory : [];
  const amountChanges = Array.isArray(amountHistory) ? amountHistory : [];

  const paidAmountFromHistory = normalizeCurrency(totalPaid);
  const paidAmount =
    paidAmountFromHistory > 0
      ? paidAmountFromHistory
      : baseStatus === 'paid'
        ? totalAmount
        : 0;

  const balanceAmount = Math.max(totalAmount - paidAmount, 0);

  const status =
    balanceAmount <= 0
      ? 'paid'
      : paidAmount > 0
        ? 'partially_paid'
        : baseStatus === 'partial'
          ? 'partially_paid'
          : 'pending';

  return {
    _id: String(bill.id),
    billId: bill.id,
    billNumber: bill.billNo,
    storeId: bill.storeId,
    customerId: bill.customerId,
    customerName: bill.customerName || 'N/A',
    customerPhone: bill.customerPhone || '',
    customerEmail: bill.customerEmail || '',
    customerAddress: bill.customerAddress || null,
    customerGstin: bill.customerGstin || null,
    billDate: bill.date,
    originalAmount: totalAmount,
    initialOriginalAmount,
    paidAmount,
    balanceAmount,
    status,
    paymentMethod: bill.paymentMethod || bill.payment_method || 'cash', // Payment method from bills table
    paymentHistory: payments,
    amountChangeHistory: amountChanges,
    notes: bill.notes || '',
    sgstRateGlobal: metaData.sgstRateGlobal !== undefined ? metaData.sgstRateGlobal : null,
    cgstRateGlobal: metaData.cgstRateGlobal !== undefined ? metaData.cgstRateGlobal : null,
    isHidden: isHidden,
  };
};

const loadCreditById = async (creditId) => {
  const { bills } = await listBills({
    page: 1,
    limit: 1,
    billId: creditId,
  });
  const bill = bills.find((item) => String(item.id) === String(creditId));
  if (!bill) {
    return null;
  }

  const { metaMap, amountHistoryMap, paymentHistoryMap } = await getCustomerCreditDetails([
    bill.id,
  ]);

  const paymentBucket = paymentHistoryMap.get(String(bill.id));
  const meta = metaMap.get(String(bill.id));

  return mapBillToCustomerCredit(bill, {
    initialAmount: meta || null,
    amountHistory: amountHistoryMap.get(String(bill.id)),
    paymentHistory: paymentBucket?.history,
    totalPaid: paymentBucket?.totalPaid,
  });
};

export const getCustomerCredits = async (req, res) => {
  try {
    const { page, limit, search, startDate, endDate, status, storeId } = req.query;

    // Get store ID from query param or user's selected store
    const resolvedStoreId = storeId 
      ? Number(storeId) 
      : (req.user?.selectedStore?.id 
          ? Number(req.user.selectedStore.id)
          : (req.user?.selectedStore?._id
              ? Number(req.user.selectedStore._id)
              : (req.user?.selectedStoreId
                  ? Number(req.user.selectedStoreId)
                  : null)));

    const filters = {
      page,
      limit,
      search,
      startDate,
      endDate,
      paymentMethod: 'credit',
    };

    // Filter by store ID if available
    if (resolvedStoreId) {
      filters.storeId = resolvedStoreId;
    }

    if (status === 'paid') {
      filters.paymentStatus = 'paid';
    } else if (status === 'partially_paid') {
      filters.paymentStatus = 'partial';
    } else if (status === 'pending') {
      filters.paymentStatus = 'pending';
    }

    const { bills, pagination } = await listBills(filters);
    const billIds = bills.map((bill) => bill.id);

    console.log(`[CustomerCredits] Query params:`, {
      storeIdFromQuery: storeId,
      resolvedStoreId,
      userSelectedStoreId: req.user?.selectedStore?.id || req.user?.selectedStore?._id || req.user?.selectedStoreId,
      paymentMethod: 'credit',
      status: filters.paymentStatus,
      search: filters.search,
      billsFound: bills.length
    });

    const { metaMap, amountHistoryMap, paymentHistoryMap } = await getCustomerCreditDetails(
      billIds
    );

    const credits = bills
      .map((bill) => {
        const paymentBucket = paymentHistoryMap.get(String(bill.id));
        const meta = metaMap.get(String(bill.id));
        return mapBillToCustomerCredit(bill, {
          initialAmount: meta || null,
          amountHistory: amountHistoryMap.get(String(bill.id)),
          paymentHistory: paymentBucket?.history,
          totalPaid: paymentBucket?.totalPaid,
        });
      })
      .filter((credit) => !credit.isHidden); // Filter out hidden bills

    res.json({
      status: 'success',
      data: {
        credits,
        pagination: buildPaginationMeta(pagination),
      },
    });
  } catch (error) {
    console.error('List customer credits error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to load customer credits.',
    });
  }
};

export const getCustomerCreditById = async (req, res) => {
  try {
    const credit = await loadCreditById(req.params.id);

    if (!credit) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer credit not found.',
      });
    }

    // Fetch item overrides for this bill
    const itemOverridesMap = await getItemOverridesForBill(credit.billId);
    const itemOverrides = [];
    itemOverridesMap.forEach((override, lineNo) => {
      itemOverrides.push({
        lineNo: Number(lineNo),
        ...override,
      });
    });
    // Sort by line number
    itemOverrides.sort((a, b) => a.lineNo - b.lineNo);

    res.json({
      status: 'success',
      data: {
        ...credit,
        itemOverrides,
      },
    });
  } catch (error) {
    console.error('Get customer credit error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to load customer credit.',
    });
  }
};

export const createCustomerCredit = async (req, res) => {
  res.status(405).json({
    status: 'error',
    message: 'Creating customer credits is not supported via this endpoint.',
  });
};

export const updateCustomerCreditAmount = async (req, res) => {
  try {
    const { newAmount, notes = '' } = req.body || {};
    const parsedAmount = normalizeCurrency(newAmount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'New amount must be greater than zero.',
      });
    }

    const credit = await loadCreditById(req.params.id);

    if (!credit) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer credit not found.',
      });
    }

    const previousAmount = normalizeCurrency(credit.originalAmount);
    const initialAmount =
      credit.initialOriginalAmount !== undefined
        ? normalizeCurrency(credit.initialOriginalAmount)
        : previousAmount;

    await ensureCreditMeta(credit.billId, initialAmount);
    await recordCreditAmountChange(
      credit.billId,
      previousAmount,
      parsedAmount,
      notes,
      req.user
        ? `${req.user.firstName ?? ''} ${req.user.lastName ?? ''}`.trim() || req.user.email || null
        : 'System'
    );
    await updateBillAmounts(credit.billId, parsedAmount);

    const totalPaid = await getTotalPaidForBill(credit.billId);
    const newStatus =
      totalPaid >= parsedAmount
        ? 'paid'
        : totalPaid > 0
          ? 'partial'
          : 'pending';
    await updateBillPaymentStatus(credit.billId, newStatus);

    const updated = await loadCreditById(req.params.id);

    res.json({
      status: 'success',
      message: 'Customer credit amount updated successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('Update customer credit amount error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update customer credit amount.',
    });
  }
};

export const updateCustomerCreditPayment = async (req, res) => {
  try {
    const { paymentAmount, notes = '', paymentMode = 'cash' } = req.body || {};
    const parsedPayment = normalizeCurrency(paymentAmount);

    if (!Number.isFinite(parsedPayment) || parsedPayment <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment amount must be greater than zero.',
      });
    }

    const credit = await loadCreditById(req.params.id);

    if (!credit) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer credit not found.',
      });
    }

    await recordCreditPayment(
      credit.billId,
      parsedPayment,
      notes,
      req.user
        ? `${req.user.firstName ?? ''} ${req.user.lastName ?? ''}`.trim() || req.user.email || null
        : 'System',
      paymentMode
    );

    const totalPaid = await getTotalPaidForBill(credit.billId);
    const currentCredit = await loadCreditById(req.params.id);
    const newStatus =
      totalPaid >= normalizeCurrency(currentCredit.originalAmount)
        ? 'paid'
        : totalPaid > 0
          ? 'partial'
          : 'pending';
    await updateBillPaymentStatus(credit.billId, newStatus);

    const updated = await loadCreditById(req.params.id);

    res.json({
      status: 'success',
      message: 'Payment recorded successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('Update customer credit payment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to record customer credit payment.',
    });
  }
};

export const updateCustomerCreditDetail = async (req, res) => {
  try {
    const { items = [], sgstRateGlobal = null, cgstRateGlobal = null, notes = '', newAmount = null } = req.body || {};
    const credit = await loadCreditById(req.params.id);
    if (!credit) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer credit not found.',
      });
    }
    // Ensure meta exists
    const initialAmount =
      credit.initialOriginalAmount !== undefined
        ? normalizeCurrency(credit.initialOriginalAmount)
        : normalizeCurrency(credit.originalAmount);
    await ensureCreditMeta(credit.billId, initialAmount);

    // Save extras and overrides
    await updateCreditMetaExtras(credit.billId, {
      sgstRateGlobal: Number.isFinite(Number(sgstRateGlobal)) ? Number(sgstRateGlobal) : null,
      cgstRateGlobal: Number.isFinite(Number(cgstRateGlobal)) ? Number(cgstRateGlobal) : null,
      notes: (notes ?? '').toString().trim() || null
    });
    if (Array.isArray(items)) {
      await replaceItemOverrides(
        credit.billId,
        items.map((it, idx) => ({
          lineNo: it.lineNo ?? idx + 1,
          itemName: it.itemName ?? it.name ?? null,
          hsnCode: it.hsnCode ?? it.hsnId ?? null,
          quantity: it.quantity,
          unitPrice: it.unitPrice ?? it.price,
          discount: it.discount ?? 0,
          taxRate: it.taxRate ?? null,
          sgstRate: it.sgstRate ?? null,
          cgstRate: it.cgstRate ?? null
        }))
      );
    }

    // Optionally update bill amount to reflect edits
    if (Number.isFinite(Number(newAmount)) && Number(newAmount) > 0) {
      await updateBillAmounts(credit.billId, Number(newAmount));
    }

    const updated = await loadCreditById(req.params.id);
    res.json({
      status: 'success',
      message: 'Customer credit details saved.',
      data: updated
    });
  } catch (error) {
    console.error('Update customer credit detail error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save customer credit details.',
    });
  }
};

export const deleteCustomerCredit = async (req, res) => {
  res.status(405).json({
    status: 'error',
    message: 'Deleting customer credits is not supported.',
  });
};

export const toggleCustomerCreditVisibility = async (req, res) => {
  try {
    const credit = await loadCreditById(req.params.id);

    if (!credit) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer credit not found.',
      });
    }

    const { isHidden = true } = req.body || {};

    await toggleCreditVisibility(credit.billId, isHidden);

    const updated = await loadCreditById(req.params.id);

    res.json({
      status: 'success',
      message: isHidden ? 'Credit hidden successfully.' : 'Credit shown successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('Toggle credit visibility error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to toggle credit visibility.',
    });
  }
};

export const getCustomerByPhone = async (req, res) => {
  try {
    const phone = String(req.params.phone || '').trim();

    if (!phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Customer phone is required.',
      });
    }

    const { bills } = await listBills({
      page: 1,
      limit: 1,
      search: phone,
      paymentMethod: 'credit',
    });

    const bill = bills.find(
      (item) => item.customerPhone && item.customerPhone.trim() === phone
    );

    if (!bill) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found.',
      });
    }

    res.json({
      status: 'success',
      data: {
        customer: {
          customerId: bill.customerId,
          customerName: bill.customerName,
          customerPhone: bill.customerPhone,
          customerEmail: bill.customerEmail,
          lastBillNumber: bill.billNo,
          lastBillDate: bill.date,
        },
      },
    });
  } catch (error) {
    console.error('Get customer by phone error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to load customer information.',
    });
  }
};

