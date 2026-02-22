import {
  createPurchaseOrder as createPurchaseOrderRepo,
  listPurchaseOrders as listPurchaseOrdersRepo,
  getPurchaseOrderById as getPurchaseOrderByIdRepo,
  updatePurchaseOrder as updatePurchaseOrderRepo,
  deletePurchaseOrder as deletePurchaseOrderRepo,
  receivePurchaseOrder as receivePurchaseOrderRepo,
  getPurchaseOrderBarcodes as getPurchaseOrderBarcodesRepo,
  regeneratePurchaseOrderBarcodes as regeneratePurchaseOrderBarcodesRepo,
} from '../repositories/purchaseOrderRepository.js';

const buildFilters = (query = {}, user = null) => {
  // Get store ID from query param or user's selected store
  const resolvedStoreId = Number(query.storeId) || 
    Number(query.store) ||
    Number(user?.selectedStore?.id) || 
    Number(user?.selectedStore?._id) ||
    Number(user?.selectedStoreId) ||
    null;

  return {
    page: query.page,
    limit: query.limit,
    search: query.search,
    storeId: resolvedStoreId,
    supplierId: query.supplierId || query.supplier,
    status: query.status,
    isCredit: query.isCredit !== undefined ? (query.isCredit === 'true' || query.isCredit === true || query.isCredit === '1' || query.isCredit === 1) : undefined,
    startDate: query.startDate,
    endDate: query.endDate,
  };
};

export const createPurchaseOrder = async (req, res) => {
  try {
    // Get store ID from body or user's selected store
    const resolvedStoreId = Number(req.body.store) ||
      Number(req.user?.selectedStore?.id) || 
      Number(req.user?.selectedStore?._id) ||
      Number(req.user?.selectedStoreId) ||
      null;

    if (!resolvedStoreId) {
      return res.status(400).json({
        status: 'error',
        message: 'Store is required. Please select a store.',
      });
    }

    const purchaseOrder = await createPurchaseOrderRepo({
      supplier: req.body.supplier,
      store: resolvedStoreId,
      orderDate: req.body.orderDate,
      expectedDeliveryDate: req.body.expectedDeliveryDate,
      items: req.body.items,
      tax: req.body.tax,
      discount: req.body.discount,
      shipping: req.body.shipping,
      partialPayment: req.body.partialPayment,
      isCredit: req.body.isCredit,
      notes: req.body.notes,
    });

    res.status(201).json({
      status: 'success',
      message: 'Purchase order created successfully.',
      data: purchaseOrder,
    });
  } catch (error) {
    console.error('Create purchase order error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to create purchase order.',
    });
  }
};

export const getPurchaseOrders = async (req, res) => {
  try {
    const { purchaseOrders, pagination } = await listPurchaseOrdersRepo(buildFilters(req.query, req.user));

    res.json({
      status: 'success',
      data: {
        purchaseOrders,
        pagination,
      },
    });
  } catch (error) {
    console.error('List purchase orders error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to load purchase orders.',
    });
  }
};

export const getPurchaseOrderById = async (req, res) => {
  try {
    const purchaseOrder = await getPurchaseOrderByIdRepo(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({
        status: 'error',
        message: 'Purchase order not found.',
      });
    }

    res.json({
      status: 'success',
      data: purchaseOrder,
    });
  } catch (error) {
    console.error('Get purchase order error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to load purchase order.',
    });
  }
};

export const updatePurchaseOrder = async (req, res) => {
  try {
    // Get store ID from body or user's selected store
    const resolvedStoreId = Number(req.body.store) ||
      Number(req.user?.selectedStore?.id) || 
      Number(req.user?.selectedStore?._id) ||
      Number(req.user?.selectedStoreId) ||
      null;

    const purchaseOrder = await updatePurchaseOrderRepo(req.params.id, {
      supplier: req.body.supplier,
      store: resolvedStoreId || req.body.store, // Use resolved store or keep original if provided
      orderDate: req.body.orderDate,
      expectedDeliveryDate: req.body.expectedDeliveryDate,
      items: req.body.items,
      tax: req.body.tax,
      discount: req.body.discount,
      shipping: req.body.shipping,
      partialPayment: req.body.partialPayment,
      isCredit: req.body.isCredit,
      notes: req.body.notes,
      status: req.body.status,
    });

    res.json(purchaseOrder);
  } catch (error) {
    console.error('Update purchase order error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update purchase order.',
    });
  }
};

export const deletePurchaseOrder = async (req, res) => {
  try {
    const deleted = await deletePurchaseOrderRepo(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Purchase order not found.',
      });
    }

    res.json({
      status: 'success',
      message: 'Purchase order deleted successfully.',
      data: deleted,
    });
  } catch (error) {
    console.error('Delete purchase order error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to delete purchase order.',
    });
  }
};

export const receivePurchaseOrder = async (req, res) => {
  try {
    const updated = await receivePurchaseOrderRepo(req.params.id);

    if (!updated) {
      return res.status(404).json({
        status: 'error',
        message: 'Purchase order not found.',
      });
    }

    res.json({
      status: 'success',
      message: 'Purchase order marked as received.',
      data: updated,
    });
  } catch (error) {
    console.error('Receive purchase order error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to receive purchase order.',
    });
  }
};

export const getPurchaseOrderBarcodes = async (req, res) => {
  try {
    const data = await getPurchaseOrderBarcodesRepo(req.params.id);

    if (!data) {
      return res.status(404).json({
        status: 'error',
        message: 'Purchase order not found.',
      });
    }

    res.json({
      status: 'success',
      data,
    });
  } catch (error) {
    console.error('Get purchase order barcodes error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to load barcodes.',
    });
  }
};

export const regeneratePurchaseOrderBarcodes = async (req, res) => {
  try {
    const data = await regeneratePurchaseOrderBarcodesRepo(req.params.id);

    if (!data) {
      return res.status(404).json({
        status: 'error',
        message: 'Purchase order not found.',
      });
    }

    res.json({
      status: 'success',
      message: 'Barcodes regenerated successfully.',
      data,
    });
  } catch (error) {
    console.error('Regenerate barcodes error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to regenerate barcodes.',
    });
  }
};

