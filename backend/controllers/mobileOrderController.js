import { queryMobileApp, isMobileAppDbConfigured } from '../db/mobileAppDb.js';

const getFirstFromRow = (row = {}, candidates = []) => {
  if (!row || typeof row !== 'object') return undefined;
  for (const key of candidates) {
    if (key in row && row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return undefined;
};

const normalizeMobileOrderRow = (row = {}) => {
  if (!row || typeof row !== 'object') return {};

  const id = getFirstFromRow(row, ['id', 'orderId', 'order_id']);
  const userId = getFirstFromRow(row, ['userId', 'userid', 'user_id']);
  const subtotal = Number(getFirstFromRow(row, ['subtotal', 'sub_total'])) || 0;
  const gst = Number(getFirstFromRow(row, ['gst', 'tax'])) || 0;
  const delivery =
    Number(getFirstFromRow(row, ['delivery', 'deliveryCharge', 'delivery_charge'])) || 0;
  const total =
    Number(getFirstFromRow(row, ['total', 'grand_total', 'grandTotal'])) || 0;
  const address = getFirstFromRow(row, ['address', 'Address']) || '';
  const paymentMethod =
    getFirstFromRow(row, ['paymentMethod', 'payment_method', 'payment_mode']) || '';
  const statusValue =
    getFirstFromRow(row, ['status', 'Status']) !== undefined
      ? getFirstFromRow(row, ['status', 'Status'])
      : 'pending';
  const status = String(statusValue || 'pending').toLowerCase();
  const orderDate =
    getFirstFromRow(row, ['orderDate', 'order_date', 'createdAt', 'created_at']) ||
    null;
  const createdAt = getFirstFromRow(row, ['createdAt', 'created_at']) || null;
  const updatedAt = getFirstFromRow(row, ['updatedAt', 'updated_at']) || null;

  const deliveryNote =
    getFirstFromRow(row, ['delivery_note', 'deliveryNote', 'delivery_details', 'deliveryDetails']) ||
    '';
  const isActiveRaw = getFirstFromRow(row, ['is_active', 'isActive', 'active']);
  let isActive = true;
  if (isActiveRaw !== undefined && isActiveRaw !== null) {
    if (typeof isActiveRaw === 'boolean') {
      isActive = isActiveRaw;
    } else if (typeof isActiveRaw === 'number') {
      isActive = isActiveRaw !== 0;
    } else {
      const normalized = String(isActiveRaw).trim().toLowerCase();
      if (['0', 'false', 'no', 'n', 'inactive'].includes(normalized)) {
        isActive = false;
      } else if (['1', 'true', 'yes', 'y', 'active'].includes(normalized)) {
        isActive = true;
      }
    }
  }

  const returnStatus =
    getFirstFromRow(row, ['return_status', 'returnStatus']) || null;
  const returnReason =
    getFirstFromRow(row, ['return_reason', 'returnReason']) || null;
  const returnImageUrl =
    getFirstFromRow(row, ['return_image_url', 'returnImageUrl']) || null;

  return {
    id,
    userId,
    subtotal,
    gst,
    delivery,
    total,
    address,
    paymentMethod,
    status,
    orderDate,
    createdAt,
    updatedAt,
    deliveryNote,
    isActive,
    returnStatus: returnStatus ? String(returnStatus).trim() : null,
    returnReason: returnReason ? String(returnReason).trim() : null,
    returnImageUrl: returnImageUrl ? String(returnImageUrl).trim() : null,
  };
};

const resolveCustomerName = (user = {}) => {
  if (!user || typeof user !== 'object') return '';

  const directCandidates = [
    user.name,
    user.fullName,
    user.full_name,
    user.customerName,
    user.customer_name,
    user.username,
    user.user_name,
    user.displayName,
    user.display_name,
  ];

  const firstName =
    user.firstName ??
    user.first_name ??
    user.firstname ??
    user.FIRSTNAME ??
    user.FIRST_NAME;
  const lastName =
    user.lastName ??
    user.last_name ??
    user.lastname ??
    user.LASTNAME ??
    user.LAST_NAME;

  if (firstName || lastName) {
    directCandidates.push(
      [firstName, lastName].filter((part) => typeof part === 'string' && part.trim()).join(' ')
    );
  }

  const cleaned = directCandidates
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  return cleaned[0] || '';
};

const resolveCustomerPhone = (user = {}) => {
  if (!user || typeof user !== 'object') return '';

  const candidates = [
    user.phone,
    user.phoneNumber,
    user.phone_number,
    user.mobile,
    user.mobileNumber,
    user.mobile_number,
    user.contact,
    user.contactNumber,
    user.contact_number,
    user.phoneno,
    user.phoneNo,
    user.PHONENO,
    user.Mobilenumber,
    user.MOBILENUMBER,
  ];

  const cleaned = candidates
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .map((value) => String(value).trim())
    .filter(Boolean);

  return cleaned[0] || '';
};

const buildUserLookupById = (users = []) => {
  const map = new Map();
  if (!Array.isArray(users)) return map;

  for (const user of users) {
    if (!user || typeof user !== 'object') continue;
    const id =
      user.id ??
      user.userId ??
      user.userid ??
      user.user_id;
    if (id === undefined || id === null) continue;
    map.set(id, user);
  }

  return map;
};

export const listMobileOrders = async (req, res) => {
  try {
    if (!isMobileAppDbConfigured()) {
      return res.status(503).json({
        status: 'error',
        message: 'Mobile app database is not configured.',
      });
    }

    const limit = Math.min(
      Math.max(parseInt(req.query.limit ?? '100', 10) || 100, 1),
      500
    );
    const offset = Math.max(parseInt(req.query.offset ?? '0', 10) || 0, 0);
    const statusFilterRaw = req.query.status;
    const statusFilter =
      typeof statusFilterRaw === 'string' && statusFilterRaw !== 'all'
        ? statusFilterRaw.toLowerCase()
        : null;

    const rows = await queryMobileApp('SELECT * FROM orders');
    const normalized = rows.map((row) => normalizeMobileOrderRow(row));

    let enriched = normalized;

    try {
      const uniqueUserIds = Array.from(
        new Set(
          normalized
            .map((order) => order.userId)
            .filter((id) => id !== null && id !== undefined)
        )
      );

      if (uniqueUserIds.length > 0) {
        const placeholders = uniqueUserIds.map(() => '?').join(',');
        const userRows = await queryMobileApp(
          `SELECT * FROM users WHERE id IN (${placeholders})`,
          uniqueUserIds
        );
        const usersById = buildUserLookupById(userRows);

        enriched = normalized.map((order) => {
          const user = usersById.get(order.userId) || null;
          return {
            ...order,
            customerName: resolveCustomerName(user),
            customerPhone: resolveCustomerPhone(user),
          };
        });
      }
    } catch (userError) {
      console.error('Failed to load mobile app users for orders:', userError.message);
      enriched = normalized;
    }

    const filtered = statusFilter
      ? enriched.filter((order) => (order.status || '').toLowerCase() === statusFilter)
      : enriched;

    const total = filtered.length;
    const pagedOrders = filtered.slice(offset, offset + limit);

    res.json({
      status: 'success',
      data: {
        orders: pagedOrders,
        pagination: {
          total,
          limit,
          offset,
        },
      },
    });
  } catch (error) {
    console.error('List mobile orders error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to load mobile app orders.',
    });
  }
};

export const getMobileOrderById = async (req, res) => {
  try {
    if (!isMobileAppDbConfigured()) {
      return res.status(503).json({
        status: 'error',
        message: 'Mobile app database is not configured.',
      });
    }

    const orderId = req.params.id;
    if (!orderId) {
      return res.status(400).json({
        status: 'error',
        message: 'Order ID is required.',
      });
    }

    const rows = await queryMobileApp('SELECT * FROM orders WHERE id = ?', [orderId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found.',
      });
    }

    let order = normalizeMobileOrderRow(rows[0]);

    if (order.userId) {
      try {
        const userRows = await queryMobileApp('SELECT * FROM users WHERE id = ?', [
          order.userId,
        ]);
        const user = Array.isArray(userRows) && userRows.length > 0 ? userRows[0] : null;
        if (user) {
          order = {
            ...order,
            customerName: resolveCustomerName(user),
            customerPhone: resolveCustomerPhone(user),
          };
        }
      } catch (userError) {
        console.error('Failed to load mobile app user for order:', userError.message);
      }
    }

    let items = [];
    try {
      // Best-effort fetch of order items; log and continue on failure
      items = await queryMobileApp('SELECT * FROM order_items WHERE orderId = ?', [
        orderId,
      ]);
    } catch (itemsError) {
      console.error('Failed to load mobile order items:', itemsError.message);
      items = [];
    }

    res.json({
      status: 'success',
      data: {
        order: {
          ...order,
          items,
        },
      },
    });
  } catch (error) {
    console.error('Get mobile order error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to load mobile app order.',
    });
  }
};

export const updateMobileOrderStatus = async (req, res) => {
  try {
    if (!isMobileAppDbConfigured()) {
      return res.status(503).json({
        status: 'error',
        message: 'Mobile app database is not configured.',
      });
    }

    const orderId = req.params.id;
    const { status } = req.body || {};

    if (!orderId || !status) {
      return res.status(400).json({
        status: 'error',
        message: 'Order ID and status are required.',
      });
    }

    const result = await queryMobileApp(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, orderId]
    );

    // mysql2 returns an OkPacket; check affectedRows if present
    const affectedRows =
      typeof result?.affectedRows === 'number'
        ? result.affectedRows
        : Array.isArray(result) && result[0]?.affectedRows !== undefined
          ? result[0].affectedRows
          : null;

    if (affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found.',
      });
    }

    res.json({
      status: 'success',
      message: 'Order status updated successfully.',
    });
  } catch (error) {
    console.error('Update mobile order status error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update mobile app order status.',
    });
  }
};

export const updateMobileOrderMeta = async (req, res) => {
  try {
    if (!isMobileAppDbConfigured()) {
      return res.status(503).json({
        status: 'error',
        message: 'Mobile app database is not configured.',
      });
    }

    const orderId = req.params.id;
    const { delivery, deliveryNote, isActive } = req.body || {};

    if (!orderId) {
      return res.status(400).json({
        status: 'error',
        message: 'Order ID is required.',
      });
    }

    const deliveryValue =
      delivery === undefined || delivery === null || delivery === ''
        ? null
        : Number(delivery);

    const isActiveValue =
      isActive === undefined || isActive === null ? 1 : isActive ? 1 : 0;

    const result = await queryMobileApp(
      'UPDATE orders SET delivery = ?, delivery_note = ?, is_active = ? WHERE id = ?',
      [deliveryValue, deliveryNote ?? '', isActiveValue, orderId]
    );

    const affectedRows =
      typeof result?.affectedRows === 'number'
        ? result.affectedRows
        : Array.isArray(result) && result[0]?.affectedRows !== undefined
          ? result[0].affectedRows
          : null;

    if (affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found.',
      });
    }

    res.json({
      status: 'success',
      message: 'Order delivery info updated successfully.',
    });
  } catch (error) {
    console.error('Update mobile order meta error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update mobile app order meta.',
    });
  }
};

export const getDeliverySettings = async (_req, res) => {
  try {
    if (!isMobileAppDbConfigured()) {
      return res.status(503).json({
        status: 'error',
        message: 'Mobile app database is not configured.',
      });
    }

    const rows = await queryMobileApp(
      'SELECT id, delivery_note, delivery_cost, is_active, updated_at FROM delivery_settings WHERE id = 1'
    );

    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    const isActive =
      row && (row.is_active === 1 || row.is_active === true || row.is_active === '1');

    res.json({
      status: 'success',
      data: {
        deliveryNote: row?.delivery_note ?? '',
        deliveryCost: row?.delivery_cost ?? 0,
        isActive,
        updatedAt: row?.updated_at ?? null,
      },
    });
  } catch (error) {
    console.error('Get delivery settings error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to load delivery settings.',
    });
  }
};

export const updateDeliverySettings = async (req, res) => {
  try {
    if (!isMobileAppDbConfigured()) {
      return res.status(503).json({
        status: 'error',
        message: 'Mobile app database is not configured.',
      });
    }

    const { deliveryNote, deliveryCost, isActive } = req.body || {};

    const costValue =
      deliveryCost === undefined || deliveryCost === null || deliveryCost === ''
        ? null
        : Number(deliveryCost);

    const isActiveValue =
      isActive === undefined || isActive === null ? 1 : isActive ? 1 : 0;

    const result = await queryMobileApp(
      'UPDATE delivery_settings SET delivery_note = ?, delivery_cost = ?, is_active = ? WHERE id = 1',
      [deliveryNote ?? '', costValue, isActiveValue]
    );

    const affectedRows =
      typeof result?.affectedRows === 'number'
        ? result.affectedRows
        : Array.isArray(result) && result[0]?.affectedRows !== undefined
          ? result[0].affectedRows
          : null;

    if (affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Delivery settings row not found.',
      });
    }

    res.json({
      status: 'success',
      message: 'Delivery settings updated successfully.',
    });
  } catch (error) {
    console.error('Update delivery settings error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update delivery settings.',
    });
  }
};

const normalizeOrderReturnRow = (row = {}) => {
  if (!row || typeof row !== 'object') return {};
  return {
    id: getFirstFromRow(row, ['id']),
    orderId: getFirstFromRow(row, ['orderId', 'order_id']),
    userId: getFirstFromRow(row, ['userId', 'user_id']),
    reason: getFirstFromRow(row, ['reason']) || null,
    imageUrl: getFirstFromRow(row, ['imageUrl', 'image_url']) || null,
    status: (getFirstFromRow(row, ['status']) || 'pending').toString().toLowerCase(),
    createdAt: getFirstFromRow(row, ['createdAt', 'created_at']) || null,
    updatedAt: getFirstFromRow(row, ['updatedAt', 'updated_at']) || null,
  };
};

export const listOrderReturns = async (req, res) => {
  try {
    if (!isMobileAppDbConfigured()) {
      return res.status(503).json({
        status: 'error',
        message: 'Mobile app database is not configured.',
      });
    }

    const orderId = req.query.orderId || req.query.order_id || null;

    let sql = 'SELECT * FROM order_returns';
    const params = [];
    if (orderId) {
      sql += ' WHERE orderId = ?';
      params.push(orderId);
    }
    sql += ' ORDER BY createdAt DESC, id DESC';

    const rows = await queryMobileApp(sql, params);
    const data = Array.isArray(rows) ? rows.map(normalizeOrderReturnRow) : [];

    res.json({
      status: 'success',
      data,
    });
  } catch (error) {
    console.error('List order returns error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to load return requests.',
    });
  }
};

export const submitOrderReturn = async (req, res) => {
  try {
    if (!isMobileAppDbConfigured()) {
      return res.status(503).json({
        status: 'error',
        message: 'Mobile app database is not configured.',
      });
    }

    const orderId = req.params.id;
    const returnReason =
      typeof req.body?.returnReason === 'string'
        ? req.body.returnReason.trim()
        : typeof req.body?.return_reason === 'string'
          ? req.body.return_reason.trim()
          : '';

    if (!orderId) {
      return res.status(400).json({
        status: 'error',
        message: 'Order ID is required.',
      });
    }

    let returnImageUrl = null;
    if (req.file && req.file.filename) {
      returnImageUrl = `/uploads/returns/${req.file.filename}`.replace(/\\/g, '/');
    }

    const result = await queryMobileApp(
      'UPDATE orders SET return_status = ?, return_reason = ?, return_image_url = ? WHERE id = ?',
      ['returned', returnReason || null, returnImageUrl, orderId]
    );

    const affectedRows =
      typeof result?.affectedRows === 'number'
        ? result.affectedRows
        : Array.isArray(result) && result[0]?.affectedRows !== undefined
          ? result[0].affectedRows
          : null;

    if (affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found.',
      });
    }

    res.json({
      status: 'success',
      message: 'Return recorded successfully.',
      data: { returnStatus: 'returned', returnReason: returnReason || null, returnImageUrl },
    });
  } catch (error) {
    console.error('Submit order return error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to record return.',
    });
  }
};

