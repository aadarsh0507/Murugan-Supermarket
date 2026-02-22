import * as creditRepository from '../repositories/creditRepository.js';

export const getAllCredits = async (req, res) => {
  try {
    // Get store ID from query param or user's selected store
    const resolvedStoreId = Number(req.query.storeId) || 
      Number(req.user?.selectedStore?.id) || 
      Number(req.user?.selectedStore?._id) ||
      Number(req.user?.selectedStoreId) ||
      null;

    const filters = {
      page: req.query.page,
      limit: req.query.limit,
      storeId: resolvedStoreId,
      supplierId: req.query.supplierId,
      status: req.query.status,
      search: req.query.search,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    const result = await creditRepository.getAllCredits(filters);

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching credits:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch credits',
    });
  }
};

export const getCreditById = async (req, res) => {
  try {
    const credit = await creditRepository.getCreditById(req.params.id);

    if (!credit) {
      return res.status(404).json({
        status: 'error',
        message: 'Credit not found.',
      });
    }

    res.json({
      status: 'success',
      data: credit,
    });
  } catch (error) {
    console.error('Error fetching credit:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch credit',
    });
  }
};

export const createCredit = async (req, res) => {
  try {
    const {
      purchaseOrderId,
      initialPayment = 0,
      notes = '',
      storeId,
      supplierId,
      supplierName,
      poNumber,
      orderDate,
      originalAmount = 0,
    } = req.body || {};

    if (!purchaseOrderId) {
      return res.status(400).json({
        status: 'error',
        message: 'purchaseOrderId is required',
      });
    }

    // If poNumber is missing, fetch it from the PO
    let finalPONumber = poNumber;
    let finalOrderDate = orderDate;
    let finalOriginalAmount = originalAmount;
    let finalSupplierId = supplierId;
    let finalSupplierName = supplierName;
    let finalStoreId = storeId;

    if (!finalPONumber || !finalOrderDate || !finalOriginalAmount) {
      try {
        const { getPurchaseOrderById } = await import('../repositories/purchaseOrderRepository.js');
        const po = await getPurchaseOrderById(purchaseOrderId);
        if (po) {
          if (!finalPONumber) finalPONumber = po.poNumber;
          if (!finalOrderDate) finalOrderDate = po.orderDate;
          if (!finalOriginalAmount) finalOriginalAmount = po.totalAmount;
          if (!finalSupplierId) finalSupplierId = po.supplierId;
          if (!finalSupplierName) finalSupplierName = po.supplierName;
          if (!finalStoreId) finalStoreId = po.storeId;
        }
      } catch (poError) {
        console.error('Error fetching PO details in createCredit:', poError);
        // Continue with provided values
      }
    }

    if (!finalPONumber) {
      return res.status(400).json({
        status: 'error',
        message: 'PO number is required',
      });
    }

    const credit = await creditRepository.createCredit({
      purchaseOrderId,
      poNumber: finalPONumber,
      supplierId: finalSupplierId,
      supplierName: finalSupplierName,
      storeId: finalStoreId,
      orderDate: finalOrderDate || new Date().toISOString(),
      originalAmount: finalOriginalAmount,
      initialPayment,
      notes,
    });

    res.status(201).json({
      status: 'success',
      message: 'Credit created successfully',
      data: credit,
    });
  } catch (error) {
    console.error('Error creating credit:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to create credit',
    });
  }
};

export const updateCreditAmount = async (req, res) => {
  try {
    const { newAmount, notes = '' } = req.body || {};
    const parsedAmount = Number.parseFloat(newAmount);

    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'New amount must be greater than zero.',
      });
    }

    // Get user info from request (if available)
    const changedBy = {
      firstName: req.user?.firstName || 'System',
      lastName: req.user?.lastName || 'User',
    };

    const credit = await creditRepository.updateCreditAmount(
      req.params.id,
      parsedAmount,
      notes,
      changedBy
    );

    res.json({
      status: 'success',
      message: 'Credit amount updated successfully.',
      data: credit,
    });
  } catch (error) {
    console.error('Error updating credit amount:', error);
    if (error.message === 'Credit not found') {
      return res.status(404).json({
        status: 'error',
        message: error.message,
      });
    }
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update credit amount',
    });
  }
};

export const updateCreditPayment = async (req, res) => {
  try {
    const { paymentAmount, notes = '', paymentMode = 'cash' } = req.body || {};
    const parsedPayment = Number.parseFloat(paymentAmount);

    if (!parsedPayment || parsedPayment <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment amount must be greater than zero.',
      });
    }

    // Get user info from request (if available)
    const collectedBy = {
      firstName: req.user?.firstName || 'System',
      lastName: req.user?.lastName || 'User',
    };

    const credit = await creditRepository.updateCreditPayment(
      req.params.id,
      parsedPayment,
      notes,
      collectedBy,
      paymentMode
    );

    res.json({
      status: 'success',
      message: 'Payment recorded successfully.',
      data: credit,
    });
  } catch (error) {
    console.error('Error updating credit payment:', error);
    if (error.message === 'Credit not found') {
      return res.status(404).json({
        status: 'error',
        message: error.message,
      });
    }
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update credit payment',
    });
  }
};

export const deleteCredit = async (req, res) => {
  try {
    const credit = await creditRepository.deleteCredit(req.params.id);

    if (!credit) {
      return res.status(404).json({
        status: 'error',
        message: 'Credit not found.',
      });
    }

    res.json({
      status: 'success',
      message: 'Credit deleted successfully.',
      data: credit,
    });
  } catch (error) {
    console.error('Error deleting credit:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to delete credit',
    });
  }
};

export const getCreditsSummaryBySupplier = async (req, res) => {
  try {
    const supplierId = req.params.supplierId || null;
    // Get store ID from query param or user's selected store
    const resolvedStoreId = Number(req.query.storeId) || 
      Number(req.user?.selectedStore?.id) || 
      Number(req.user?.selectedStore?._id) ||
      Number(req.user?.selectedStoreId) ||
      null;
    const summary = await creditRepository.getCreditsSummaryBySupplier(supplierId, resolvedStoreId);

    res.json({
      status: 'success',
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching credits summary:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch credits summary',
    });
  }
};
